import {
	Container,
	Instance,
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { NoFlags, Ref, Update } from './fiberFlags';

/** 标记fiber的更新状态 */
function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}

function markRef(fiber: FiberNode) {
	fiber.flags |= Ref;
}

export const completeWork = (wip: FiberNode) => {
	// 递归的归阶段
	if (__DEV__) {
		console.log('complete流程', wip.type);
	}

	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
				// 1.props是否发生变化， {onClick: xx} {onClick: xxx}
				// 2. 变了Update Flag
				markUpdate(wip);
				// 标记Ref
				if (wip.ref !== current.ref) {
					markRef(wip);
				}
			} else {
				// mount
				// 构建离屏DOM树
				const instance = createInstance(wip.type, newProps);
				// 将dom插入到离屏DOM，即instance中，后续在commitWork中插入到真实的DOM
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
				// 标记Ref
				if (wip.ref !== null) {
					markRef(wip);
				}
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memorizedProps?.content;
				const newText = newProps.content;
				if (oldText != newText) {
					markUpdate(wip);
				}
			} else {
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的complete边界情况', wip);
			}
			break;
	}
};

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
	let node = wip.child;

	// 先遍历子节点，自上而下，再遍历兄弟节点，自下而上
	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			// @ts-ignore
			appendInitialChild(parent, node?.stateNode);
		} else if (node.child !== null) {
			// 递归向下
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === wip) {
			return;
		}

		// 归阶段，向上移动
		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node?.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}

	wip.subtreeFlags |= subtreeFlags;
}
