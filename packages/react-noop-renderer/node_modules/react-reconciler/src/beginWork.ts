import { Fragment } from './workTags';
import { ReactElementType } from 'shared/ReactTypes';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { FiberNode } from './fiber';
import { renderWithHooks } from './fiberHooks';
import { Lane, Lanes, NoLane } from './fiberLanes';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { Ref } from './fiberFlags';

export const beginWork = (workInProgress: FiberNode, renderLanes: Lanes) => {
	if (__DEV__) {
		console.log('beginWork流程', workInProgress.type);
	}
	// 接下来processUpdate会消耗lanes
	workInProgress.lanes = NoLane;

	// 通过reactElement和fiberNode比较，返回子fiberNode
	switch (workInProgress.tag) {
		case HostRoot:
			// 计算状态的最新值
			// 创建子fiberNode, 该fiberNode是根节点
			return updateHostRoot(workInProgress, renderLanes);
		case HostComponent:
			// 创造子fiberNode
			return updateHostComponent(workInProgress, renderLanes);
		case HostText:
			// 递归到了叶子节点，开始completeWork
			return null;
		case FunctionComponent:
			return updateFunctionComponent(workInProgress, renderLanes);
		case Fragment:
			return updateFragment(workInProgress, renderLanes);
		default:
			console.error('beginWork未处理的情况');
			return null;
	}
};

function updateFragment(workInProgress: FiberNode, renderLanes: Lanes) {
	const nextChildren = workInProgress.pendingProps;
	reconcileChildren(workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function updateFunctionComponent(
	workInProgress: FiberNode,
	renderLanes: Lanes
) {
	// 执行函数组件，hooks开始工作
	// 执行完此步骤后和正常运行jsx的流程是一致的
	const nextChildren = renderWithHooks(workInProgress, renderLanes);
	reconcileChildren(workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function updateHostComponent(workInProgress: FiberNode, renderLanes: Lanes) {
	// 根据element创建fiberNode
	const nextProps = workInProgress.pendingProps;
	const nextChildren = nextProps.children;
	markRef(workInProgress.alternate, workInProgress);
	reconcileChildren(workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

function updateHostRoot(workInProgress: FiberNode, renderLanes: Lanes) {
	const baseState = workInProgress.memorizedState;
	const updateQueue =
		workInProgress.updateQueue as UpdateQueue<ReactElementType>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memorizedState } = processUpdateQueue(
		baseState,
		pending,
		renderLanes
	);
	workInProgress.memorizedState = memorizedState;

	const nextChildren = workInProgress.memorizedState;
	reconcileChildren(workInProgress, nextChildren, renderLanes);
	return workInProgress.child;
}

/** 建立 fiberNode的child连接；
 *  处理 childDeletion的情况；
 *  处理 节点移动的情况
 */
function reconcileChildren(
	workInProgress: FiberNode,
	children: any,
	renderLanes: Lanes
) {
	const current = workInProgress.alternate;

	if (current !== null) {
		// update
		// 在首屏渲染时，由于root.current存在，会执行到此，运行一次placement插入操作
		// reconcileChildFibers 和 mountChildFibers的区别在于是否追踪副作用
		// reconcileChildFibers会追踪副作用，并且他们都会将element转变为 fiberNode
		workInProgress.child = reconcileChildFibers(
			workInProgress,
			current.child,
			children,
			renderLanes
		);
	} else {
		// mount
		workInProgress.child = mountChildFibers(
			workInProgress,
			null,
			children,
			renderLanes
		);
	}
}

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	const ref = workInProgress.ref;

	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgress.flags |= Ref;
	}
}
