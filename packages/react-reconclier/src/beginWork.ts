import { ReactElementType } from 'shared/ReactTypes';

import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';

// 递归中的递阶段
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	if (__DEV__) {
		console.log('beginWork流程', wip.type);
	}

	// 通过reactElement和fiberNode比较，返回子fiberNode
	switch (wip.tag) {
		case HostRoot:
			// 计算状态的最新值
			// 创建子fiberNode, 该fiberNode是根节点
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			// 创造子fiberNode
			return updateHostComponent(wip);
		case HostText:
			// 递归到了叶子节点，开始completeWork
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}

	return null;
};

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	// 执行函数组件，hooks开始工作
	// 执行完此步骤后和正常运行jsx的流程是一致的
	const nextChildren = renderWithHooks(wip, renderLane);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memorizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memorizedState } = processUpdateQueue(baseState, pending, renderLane);
	wip.memorizedState = memorizedState;

	const nextChildren = wip.memorizedState;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

/** 建立 fiberNode的child连接；
 *  处理 childDeletion的情况；
 *  处理 节点移动的情况
 */
function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate;

	if (current !== null) {
		// update
		// 在首屏渲染时，由于root.current存在，会执行到此，运行一次placement插入操作
		// reconcileChildFibers 和 mountChildFibers的区别在于是否追踪副作用
		// reconcileChildFibers会追踪副作用，并且他们都会将element转变为 fiberNode
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount
		wip.child = mountChildFibers(wip, null, children);
	}
}
