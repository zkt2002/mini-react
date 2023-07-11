import { CallbackNode } from 'scheduler';
import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	WorkTag
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';

export class FiberNode {
	pendingProps: Props;
	memorizedProps: Props | null;
	key: Key;
	stateNode: any;
	type: any;
	ref: Ref;
	tag: WorkTag;
	flags: Flags;
	subtreeFlags: Flags;
	deletions: FiberNode[] | null;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	updateQueue: unknown;
	memorizedState: any;

	// 指向双缓存树对应的另一棵树
	alternate: FiberNode | null;

	lanes: Lanes;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key || null;
		// HostComponent <div></div> div DOM
		this.stateNode = null;
		// FunctionComponent () => {}
		this.type = null;

		// 构成树形结构
		this.return = null;
		this.sibling = null;
		this.child = null;
		//   同级相同标签的索引
		this.index = 0;
		// @ts-ignore
		this.ref = null;

		// 作为工作单元
		this.pendingProps = pendingProps;
		// 确定下来的props
		this.memorizedProps = null;
		this.updateQueue = null;
		this.memorizedState = null;

		this.alternate = null;
		// 副作用
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;

		this.lanes = NoLane;
	}
}

export interface PendingPassiveEffects {
	unmount: Effect[];
	update: Effect[];
}

export class FiberRootNode {
	container: Container;
	// 指向hostRootFiber
	current: FiberNode;
	// 更新完成后的fibernode
	finishedWork: FiberNode | null;
	/** 未被消费的lane的集合 */
	pendingLanes: Lanes;
	/** 本次更新消费的lane */
	finishedLane: Lane;
	/** 用于保存未执行的effect,包括更新和卸载两种情况 */
	pendingPassiveEffects: PendingPassiveEffects;

	/** 用于保存当前执行的render回调函数 */
	callbackNode: CallbackNode | null;
	/** 当前render的优先级 */
	callbackPriority: Lane;

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;

		this.callbackNode = null;
		this.callbackPriority = NoLane;

		// 保存未执行的effect
		this.pendingPassiveEffects = {
			// 属于卸载组件的
			unmount: [],
			// 属于更新组件的
			update: []
		};
	}
}

/** 用于创建新的wip树,处理react更新的一切流程 */
export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	// 除了mount时创建一个新的fiberNode,后面的更新流程都是在current和wip两颗树直接来回切换
	let wip = current.alternate;

	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.type = current.type;
		wip.stateNode = current.stateNode;

		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		// 清除之前遗留的flags
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;

	// 数据
	wip.memorizedProps = current.memorizedProps;
	wip.memorizedState = current.memorizedState;
	wip.ref = current.ref;

	wip.lanes = current.lanes;

	return wip;
};

export function createFiberFromElement(
	element: ReactElementType,
	lanes: Lanes
): FiberNode {
	const { type, key, props, ref } = element;
	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		fiberTag = HostComponent;
	} else if (typeof type !== 'function') {
		console.error('未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	fiber.lanes = lanes;
	fiber.ref = ref;

	return fiber;
}

export function createFiberFromFragment(
	elements: ReactElementType[],
	lanes: Lanes,
	key: Key
): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);
	fiber.lanes = lanes;
	return fiber;
}
