// @ts-nocheck
import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';
import { Fragment } from './workTags';

type ExistingChildren = Map<string | number, FiberNode>;

function ChildReconclier(shouldTrackEffects: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return;
		}
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childToDelete);
		}
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			return;
		}
		let childToDelete = currentFirstChild;
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
		}
	}

	/** 处理单一reactElement节点,因此如果之前该节点有兄弟节点的话应该都需要被删除 */
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key;
		while (currentFiber !== null) {
			// update
			if (currentFiber.key === key) {
				// key相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						let props = element.props;
						if (element.type === REACT_FRAGMENT_TYPE) {
							props = element.props.children;
						}
						// type相同
						const existing = useFiber(currentFiber, props);
						existing.return = returnFiber;
						// 当前节点可复用，其他兄弟节点都删除
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return existing;
					}
					// key相同但type不同，没法复用。后面的兄弟节点也没有复用的可能性了，都删除
					deleteChild(returnFiber, currentFiber);
					break;
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element);
						break;
					}
				}
			} else {
				// 删掉旧的
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}

		// 如果currentFiber为空或者出现所有节点的都不能复用的情况，新建一个fiber节点插入
		// 根据element创建一个fiber
		let fiber;
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key);
		} else {
			fiber = createFiberFromElement(element);
		}
		fiber.return = returnFiber;
		return fiber;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// tag没变，可以复用
				if (__DEV__) {
					console.log('beginWork流程文本节点复用', currentFiber, content);
				}
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return existing;
			}
			deleteChild(returnFiber, currentFiber);
			currentFiber = currentFiber.sibling;
		}

		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	function placeSingleChild(fiber: FiberNode) {
		// 在首屏渲染并且需要追踪副作用的情况下标记副作用flags
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement;
		}
		return fiber;
	}

	/** 处理多节点的情况，包含diff算法 */
	function reconclieChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		newChild: any[]
	) {
		/** 最后一个可复用的fiber在current中的index */
		let lastPlacedIndex = 0;
		/** 创建的最后一个fiber */
		let lastNewFiber: FiberNode | null = null;
		/** 创建的第一个fiber */
		let firstNewFiber: FiberNode | null = null;

		// 1.遍历前的准备工作，将current保存在map中
		const existingChildren: ExistingChildren = new Map();
		let current = currentFirstChild;
		while (current !== null) {
			const keyToUse = current.key !== null ? current.key : current.index;
			existingChildren.set(keyToUse, current);
			current = current.sibling;
		}

		for (let i = 0; i < newChild.length; i++) {
			// 2.遍历newChild，寻找是否可复用
			const after = newChild[i];
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after);

			/**
			 * 考虑如下情况：
			 * 更新前：你好{123}
			 * 更新后：你好{null}
			 *   或者：你好{false}
			 *   或者：你好{undefined}
			 */
			if (newFiber === null) {
				continue;
			}

			// 3.标记移动还是插入
			newFiber.index = i;
			newFiber.return = returnFiber;

			// 构建子节点之间的关联，即兄弟节点关系 sibling
			if (lastNewFiber === null) {
				lastNewFiber = newFiber;
				firstNewFiber = newFiber;
			} else {
				lastNewFiber.sibling = newFiber;
				lastNewFiber = lastNewFiber.sibling;
			}

			// mount节点时候不需要处理节点的移动和删除情况，因此可以直接continue
			if (!shouldTrackEffects) {
				continue;
			}

			const current = newFiber.alternate;
			if (current !== null) {
				const oldIndex = current.index;
				if (oldIndex < lastPlacedIndex) {
					// 移动
					newFiber.flags |= Placement;
					continue;
				} else {
					// 不移动
					lastPlacedIndex = oldIndex;
				}
			} else {
				// mount 插入节点
				newFiber.flags |= Placement;
			}
		}
		// 4.将Map中剩下的标记删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});

		return firstNewFiber;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		element: any
	): FiberNode | null {
		const keyToUse = element.key !== null ? element.key : index;
		const before = existingChildren.get(keyToUse);

		// 处理文本节点
		if (typeof element === 'string' || typeof element === 'number') {
			// fiber key相同，如果type也相同，则可复用
			if (before?.tag === HostText) {
				// 复用文本节点
				existingChildren.delete(keyToUse);
				return useFiber(before, { content: element + '' });
			}
			return new FiberNode(HostText, { content: element + '' }, null);
		}

		// ReactELement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							before,
							element,
							keyToUse,
							existingChildren
						);
					}
					if (before) {
						if (before.type === element.type) {
							// fiber key相同，如果type也相同，则可复用
							existingChildren.delete(keyToUse);
							return useFiber(before, element.props);
						}
					}
					return createFiberFromElement(element);
			}
		}

		if (Array.isArray(element)) {
			return updateFragment(
				returnFiber,
				before,
				element,
				keyToUse,
				existingChildren
			);
		}
		return null;
	}

	return function reconcileChildrenFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		// 判断当前的fiber类型

		// 判断为Fragment
		// 顶层包裹元素的Fragment
		// 比如 Function App(){ return <></> }
		const isUnkeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.$$typeof === REACT_FRAGMENT_TYPE &&
			newChild.key === null;

		if (isUnkeyedTopLevelFragment) {
			newChild = newChild?.props.children;
		}

		// newChild 为 JSX
		// currentFirstChild 为 fiberNode
		if (typeof newChild === 'object' && newChild !== null) {
			// 第一层数组直接遍历，嵌套数组作为Fragment处理
			// 如： <ul><li/>{[<li/>, <li/>]}</ul>
			if (Array.isArray(newChild)) {
				return reconclieChildrenArray(returnFiber, currentFiber, newChild);
			}

			switch (newChild.$$typeof) {
				// <div>
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);
				default:
					if (__DEV__) {
						console.warn('未实现的reconcile类型', newChild);
					}
					break;
			}
		}

		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}

		// newChild为null的情况，其他情况全部视为删除旧的节点
		// 兜底删除
		deleteRemainingChildren(returnFiber, currentFiber);

		return null;
	};
}

/** 用于处理复用的情况 */
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps);
	clone.index = 0;
	clone.sibling = null;
	return clone;
}

function updateFragment(
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	elements: any[],
	key: Key,
	existingChildren: ExistingChildren
) {
	let fiber;
	if (!current || current.tag !== Fragment) {
		fiber = createFiberFromFragment(elements, key);
	} else {
		// 复用的情况
		existingChildren.delete(key);
		fiber = useFiber(current, elements);
	}
	fiber.return = returnFiber;
	return fiber;
}

// 追踪副作用
export const reconcileChildFibers = ChildReconclier(true);
// 不追踪副作用
export const mountChildFibers = ChildReconclier(false);
