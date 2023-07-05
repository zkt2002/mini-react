import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;

// 在更新初始化的时候，会创建一个root.current对应的wip树
function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {});
}

// 连接container和renderRoot的函数
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	// 调度功能
	// fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	renderRoot(root);
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

function renderRoot(root: FiberRootNode) {
	// 初始化
	prepareFreshStack(root);

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

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;

	// wip fiberNode树 树中的flags 执行具体的DOM操作
	commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	// if (__LOG__) {
	// 	console.log('开始commit阶段', finishedWork);
	// }

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}

	// 重置
	root.finishedWork = null;

	// 判断是否存在3个子阶段需要执行的操作
	// root flags root subtreeFlags
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	// 有更新的情况
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation Placement
		commitMutationEffects(finishedWork);

		root.current = finishedWork;
		// layout
	} else {
		// 无更新的情况，finishedWork代表wip树，依然需要被渲染
		root.current = finishedWork;
	}
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
	const next = beginWork(fiber);
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
