import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

// 更新的基本元素
export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
}

// 消费更新元素的队列
export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	if (__DEV__) {
		console.log('创建update：', action, lane);
	}
	return {
		action,
		next: null,
		lane
	};
};

export const createUpdateQueue = <Action>(): UpdateQueue<Action> => {
	const updateQueue: UpdateQueue<Action> = {
		shared: {
			pending: null
		},
		dispatch: null
	};

	return updateQueue;
};

// 向更新队列中添加更新元素的函数
export const enqueueUpdate = <Action>(
	updateQueue: UpdateQueue<Action>,
	update: Update<Action>
) => {
	if (__DEV__) {
		console.log('将update插入更新队列：', update);
	}
	const pending = updateQueue.shared.pending;
	// 构造环形链表
	if (pending === null) {
		// pending = a -> a,pengding指向updateQueue中最后插入的那个update
		update.next = update;
	} else {
		// pengding = b -> a -> b
		// c.next = b.next
		update.next = pending.next;
		// b.next = c
		pending.next = update;
	}
	// pending = c -> a -> b -> c
	// updateQueue.shared.pending是环状更新链表的最后一个元素
	// updateQueue.shared.pending.next是环状更新链表的第一个元素
	updateQueue.shared.pending = update;
};

/** 消费更新队列中的更新元素 */
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memorizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memorizedState: baseState
	};
	// pending: c a b c
	// 先取c.next 即a，之后顺序执行abc的更新，最后到 a===a,跳出循环

	if (pendingUpdate !== null) {
		// 第一个update
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;
		do {
			const updateLane = pending.lane;
			if (updateLane === renderLane) {
				const action = pending.action;
				if (action instanceof Function) {
					// baseState 1 update (x) => 4x -> memorizedState 4
					baseState = action(baseState);
				} else {
					// baseState 1 update 2 -> memorizedState 2
					baseState = action;
				}
			} else {
				if (__DEV__) {
					console.error('不应该进入这个逻辑');
				}
			}
			pending = pending.next as Update<any>;
		} while (pending !== first);
		result.memorizedState = baseState;
	}
	return result;
};
