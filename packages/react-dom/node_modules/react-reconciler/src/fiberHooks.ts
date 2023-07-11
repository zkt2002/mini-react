import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher } from 'react/src/currentDispatcher';
import { Dispatch } from 'react/src/currentDispatcher';
import currentBatchConfig from 'react/src/currentBatchConfig';
import {
	Update,
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTag';

// 指向当前运行的fiberNode
let currentlyRenderingFiber: FiberNode | null = null;
// 指向当前运行的hook
/** 执行当前运行的Hook，该wiphook是进行操作的，类似wip和current的双缓存hook */
let workInProgressHook: Hook | null = null;
/** 从当前FC中获取的Hook，指向当前运行到的hook，他运行后的结果会给workInProgressHook */
let currentHook: Hook | null = null;

const { currentDispatcher } = internals;
let renderLane: Lane = NoLane;

interface Hook {
	// 指向hook自身的数据
	memorizedState: any;
	UpdateQueue: unknown;
	next: Hook | null;
	/** 初始参与计算的state，他与memorizedState的区别是，
	 *  他保存最后一个未被跳过的update计算后的结果
	 *  如果没有update被跳过，则他和memorizedState是一致的
	 */
	baseState: any;
	/** 保存上一次因为优先级不足未执行的update */
	baseQueue: Update<any> | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | void;
	destroy: EffectCallback | void;
	deps: EffectDeps;
	next: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

/** function组件的入口，在该函数中会执行函数组件 */
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值操作
	currentlyRenderingFiber = wip;
	// 重置 hooks 链表
	wip.memorizedState = null;
	// 重置 effect链表
	wip.updateQueue = null;
	renderLane = lane;

	const current = wip.alternate;

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispathcerOnUpdate;
	} else {
		// mount
		currentDispatcher.current = HooksDispathcerOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	// 此步骤会执行useState Component即函数组件,FC render
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;
	return children;
}

const HooksDispathcerOnMount: Dispatcher = {
	useState: mountState,
	// @ts-ignore
	useEffect: mountEffect,
	useTransition: mountTransition,
	useRef: mountRef
};

const HooksDispathcerOnUpdate: Dispatcher = {
	useState: updateState,
	// @ts-ignore
	useEffect: updateEffect,
	useTransition: updateTransition,
	useRef: updateRef
};

function mountEffect(create: EffectCallback | void, deps: EffectDeps) {
	const hook = mountWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

	hook.memorizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps) {
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallback | void;

	if (currentHook !== null) {
		const prevEffect = currentHook.memorizedState as Effect;
		destroy = prevEffect.destroy;

		if (nextDeps !== null) {
			// 浅比较依赖
			const prevDeps = prevEffect.deps;
			if (areHookInputEqual(prevDeps, nextDeps)) {
				hook.memorizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}
		}
	}
	// 浅比较不相等,会执行effect副作用
	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

	hook.memorizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		// @ts-ignore
		destroy,
		nextDeps
	);
}

function areHookInputEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	// 对应不传deps的情况
	if (prevDeps === null || nextDeps === null) {
		return false;
	}

	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue;
		}
		return false;
	}

	return true;
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};

	const fiber = currentlyRenderingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		// 插入effect
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}

	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

/** 更新时的useState */
function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = updateWorkInProgressHook();

	// 计算新state的逻辑
	const queue = hook.UpdateQueue as UpdateQueue<State>;
	const baseState = hook.baseState;

	const pending = queue.shared.pending;
	const current = currentHook as Hook;
	let baseQueue = current.baseQueue;

	if (pending !== null) {
		// pending baseQueue update保存在current中
		if (baseQueue !== null) {
			// 上次因为优先级不足而未执行的update
			// baseQueue b2 -> b0 -> b1 -> b2
			// pendingQueue p2 -> p0 -> p1 -> p2
			// b0
			const baseFirst = baseQueue.next;
			// p0
			const pengdingFirst = pending.next;
			// b2 -> p0
			baseQueue.next = pengdingFirst;
			// p2 -> b0
			pending.next = baseFirst;
			// p2 -> b0 -> b1 -> b2 -> p0 -> p1 -> p2
		}
		baseQueue = pending;
		// 保存在current中
		current.baseQueue = pending;
		// 每次更新完之后需要置空，否则后续的更新会一直被添加进入queue中
		queue.shared.pending = null;
	}

	if (baseQueue !== null) {
		const {
			memorizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(baseState, baseQueue, renderLane);
		hook.memorizedState = memorizedState;
		hook.baseQueue = newBaseQueue;
		hook.baseState = newBaseState;
	}

	return [hook.memorizedState, queue.dispatch as Dispatch<State>];
}

/**
 * 从当前这个fiber的alternate，也就是currentFiber中取到对应的hook，
 * 然后通过这个hook取到一个新的hook的数据，并且返回,相当于 .next取值
 */
function updateWorkInProgressHook(): Hook {
	// todo render阶段触发的更新
	let nextCurrentHook: Hook | null;

	if (currentHook === null) {
		// 这是这个FC update时的第一个hook
		const current = currentlyRenderingFiber?.alternate;
		if (current !== null) {
			// update
			nextCurrentHook = current?.memorizedState;
		} else {
			// mount
			nextCurrentHook = null;
		}
	} else {
		// 这个FC update时后续的 hook
		nextCurrentHook = currentHook.next;
	}

	if (nextCurrentHook === null) {
		// mount/update u1 u2 u3
		// update       u1 u2 u3 u4
		// nextCurrentHook是上一个hook的next，比如在if中创建hook
		// 在第一次更新时没有，在第二次更新创建了hook，此时这个hook
		// 会到 nextCurrentHook = currentHook.next; 这段逻辑中
		// 而第一次到u3已经没有next了， 此时进入现在这个if中报错
		// 还一种情况时在mount流程中进入该函数，必然是获取不到的，也会报错
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的hook比上次执行时多`
		);
	}

	currentHook = nextCurrentHook as Hook;
	const newHook: Hook = {
		memorizedState: currentHook.memorizedState,
		UpdateQueue: currentHook.UpdateQueue,
		next: null,
		baseQueue: currentHook.baseQueue,
		baseState: currentHook.baseState
	};

	if (workInProgressHook === null) {
		// hook mount,第一个hook
		if (currentlyRenderingFiber === null) {
			// 说明在一个不是函数组件的上下文使用hooks
			throw new Error('请在函数组件内调用Hook');
		} else {
			workInProgressHook = newHook;
			currentlyRenderingFiber.memorizedState = workInProgressHook;
		}
	} else {
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}

	return workInProgressHook;
}

/** mount时的useState */
function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = mountWorkInProgressHook();
	let memorizedState;
	if (initialState instanceof Function) {
		memorizedState = initialState();
	} else {
		memorizedState = initialState;
	}
	const queue = createUpdateQueue<State>();
	hook.UpdateQueue = queue;
	hook.memorizedState = memorizedState;
	hook.baseState = memorizedState;

	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	queue.dispatch = dispatch;

	return [memorizedState, dispatch];
}

/** useState调用 setXXX函数更新时候对应的dispatch */
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLane();
	const update = createUpdate(action, lane);

	enqueueUpdate(updateQueue, update);

	scheduleUpdateOnFiber(fiber, lane);
}

/**
 * 创建一个新的Hook返回,并且会建立hooks的连接
 */
function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memorizedState: null,
		UpdateQueue: null,
		next: null,
		baseQueue: null,
		baseState: null
	};

	if (workInProgressHook === null) {
		// hook mount,第一个hook
		if (currentlyRenderingFiber === null) {
			// 说明在一个不是函数组件的上下文使用hooks
			throw new Error('请在函数组件内调用Hook');
		} else {
			workInProgressHook = hook;
			currentlyRenderingFiber.memorizedState = workInProgressHook;
		}
	} else {
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}

	return workInProgressHook;
}

/** useTransition Start */
function mountTransition(): [boolean, (callback: () => void) => void] {
	const [isPending, setPending] = mountState(false);
	const hook: Hook = mountWorkInProgressHook();
	const start = startTransition.bind(null, setPending);
	hook.memorizedState = start;
	return [isPending, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
	const [isPending] = updateState();
	const hook = updateWorkInProgressHook();
	const start = hook.memorizedState;
	return [isPending as boolean, start];
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
	setPending(true);
	const prevTransition = currentBatchConfig.transition;
	currentBatchConfig.transition = 1;

	// 这两个更新会同步更新
	callback();
	setPending(false);
	currentBatchConfig.transition = prevTransition;
}
/** useTransition End */

/** useRef start */
function mountRef<T>(initialValue: T): { current: T } {
	const hook = mountWorkInProgressHook();
	const ref = { current: initialValue };
	hook.memorizedState = ref;
	return ref;
}

function updateRef<T>(initialValue: T): { current: T } {
	const hook = updateWorkInProgressHook();
	return hook.memorizedState;
}
/** useRef End */
