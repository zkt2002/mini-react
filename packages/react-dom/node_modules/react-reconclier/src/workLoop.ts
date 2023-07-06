import { scheduleMicrotask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects,
	createWorkInProgress
} from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTag';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
/** effect执行锁，保证effect回调只执行一次 */
let rootDoesHavePassiveEffects = false;

/** 在更新初始化的时候，会创建一个root.current对应的wip树 */
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

/** 连接container和performSyncWorkOnRoot的函数,更新时的驱动函数 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	if (__DEV__) {
		console.log('开始schedule阶段', fiber, lane);
	}
	// 调度功能
	// fiberRootNode
	// 每个fiber节点都能够触发更新,但是更新需要从根节点开始，因此要向上找，直到寻找到根节点
	const root = markUpdateFromFiberToRoot(fiber);
	markRootUpdated(root, lane);
	console.log('root', root);
	if (root === null) {
		return;
	}
	ensureRootIsScheduled(root);
}

/** schedule阶段入口 */
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	// 代表没有update，即没有更新
	if (updateLane === NoLane) {
		return;
	}

	if (updateLane === SyncLane) {
		// 同步优先级，用微任务调度
		if (__DEV__) {
			console.log('在微任务中调度，优先级为：', updateLane);
		}
		// [performSyncWorkOnRoot,performSyncWorkOnRoot，performSyncWorkOnRoot]
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));

		// flushSyncCallbacks放入微任务中调度，虽然放入多个，但flushSyncCallbacks函数中
		// 通过isFlushingSyncQueue变量锁，同一次批处理更新中，只会执行一次该函数
		scheduleMicrotask(flushSyncCallbacks);
	} else {
		// 其他优先级，用宏任务调度
	}
}

/** 将lane记录在fiberRootNode中 */
function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// 从当前fiber向上寻找到根fiber的函数
function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}

	if (node.tag === HostRoot) {
		// 对应FiberRootNode
		return node.stateNode;
	}

	return null;
}
/** render阶段入口 */
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		// 其他比SyncLane低的优先级
		// NoLane
		ensureRootIsScheduled(root);
		return;
	}

	if (__DEV__) {
		console.warn('render阶段开始');
	}

	// 初始化
	prepareFreshStack(root, lane);

	do {
		try {
			workLoop();
			break;
		} catch (error) {
			if (__DEV__) {
				console.warn('workLoop has unexpected error', error);
			}
			workInProgress = null;
		}
	} while (true);

	// render阶段结束
	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;
	root.finishedLane = lane;
	wipRootRenderLane = NoLane;

	// wip fiberNode树 树中的flags 执行具体的DOM操作
	commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}
	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}
	const lane = root.finishedLane;
	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finishedLane不应该是NoLane');
	}

	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

	markRootFinished(root, lane);

	/*
		useEffect的执行包括2种情况：
			1. deps变化导致的
			2. 组件卸载，触发destory
			首先在这里调度回调
	*/
	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		// 当前这个wip树中是存在useEffect回调需要执行的
		if (!rootDoesHavePassiveEffects) {
			rootDoesHavePassiveEffects = true;
			// 调度副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 判断是否存在3个子阶段需要执行的操作
	// root flags root subtreeFlags
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	// 有更新的情况
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation Placement
		commitMutationEffects(finishedWork, root);

		root.current = finishedWork;
		// layout
	} else {
		// 无更新的情况，finishedWork代表wip树，依然需要被渲染
		root.current = finishedWork;
	}

	rootDoesHavePassiveEffects = false;
	ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	pendingPassiveEffects.unmount.forEach((effect) => {
		// 不需要HasEffect，因为unmount时一定会触发effect destroy
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});
	// 任何create都得在所有destroy执行后再执行
	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];
	flushSyncCallbacks();
}

/** reconclie的关键函数，beginwork和completeWork的调用处
 *
 *  从父节点开始beginWork -> 子节点 beginWork -> 子节点completeWork -> 父节点completeWork
 *  -> 父级的兄弟节点completeWork
 */
function workLoop() {
	while (workInProgress != null) {
		performUnitOfWork(workInProgress);
	}
}

// workLoop执行对应的方法
function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber, wipRootRenderLane);
	// beginWork执行结束，props已经确定下来
	fiber.memorizedProps = fiber.pendingProps;

	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	// completeWork流程 叶子节点 -> 叶子节点的兄弟节点 -> 叶子节点的父节点
	do {
		completeWork(node);

		const sibling = node.sibling;
		// 开始遍历兄弟节点
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}

		node = node.return;
		workInProgress = node;
	} while (node !== null);
}
