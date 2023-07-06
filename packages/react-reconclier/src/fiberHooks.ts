import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher } from 'react/src/currentDispatcher';
import { Dispatch } from 'react/src/currentDispatcher';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';

// 指向当前运行的fiberNode
let currentlyRenderingFiber: FiberNode | null = null;
// 指向当前运行的hook
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;

const { currentDispatcher } = internals;
let renderLane: Lane = NoLane;

interface Hook {
	// 指向hook自身的数据
	memorizedState: any;
	UpdateQueue: unknown;
	next: Hook | null;
}

/** function组件的入口，在该函数中会执行函数组件 */
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值操作
	currentlyRenderingFiber = wip;
	// 重置 hooks 链表
	wip.memorizedState = null;
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
	useState: mountState
};

const HooksDispathcerOnUpdate: Dispatcher = {
	useState: updateState
};

/** 更新时的useState */
function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = updateWorkInProgressHook();

	// 计算新state的逻辑
	const queue = hook.UpdateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;

	if (pending !== null) {
		const { memorizedState } = processUpdateQueue(
			hook.memorizedState,
			pending,
			renderLane
		);
		hook.memorizedState = memorizedState;
		// 每次更新完之后需要置空，否则后续的更新会一直被添加进入queue中
		queue.shared.pending = null;
	}

	return [hook.memorizedState, queue.dispatch as Dispatch<State>];
}

/**
 * 从当前这个fiber的alternate，也就是currentFiber中取到对应的hook，
 * 然后通过这个hook取到一个新的hook的数据，并且返回
 */
function updateWorkInProgressHook(): Hook {
	// todo render阶段触发的更新
	let nextCurrentHook: Hook | null;

	if (currentHook === null) {
		// 这是这个FC update时的第一个hook
		const current = currentlyRenderingFiber?.alternate;
		if (current !== null) {
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
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的hook比上次执行时多`
		);
	}

	currentHook = nextCurrentHook as Hook;
	const newHook: Hook = {
		memorizedState: currentHook.memorizedState,
		UpdateQueue: currentHook.UpdateQueue,
		next: null
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
	hook.memorizedState = memorizedState;
	const queue = createUpdateQueue<State>();
	hook.UpdateQueue = queue;

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
 * 创建一个新的Hook返回
 */
function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memorizedState: null,
		UpdateQueue: null,
		next: null
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
