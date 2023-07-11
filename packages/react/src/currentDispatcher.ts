import { Action } from 'shared/ReactTypes';

export interface Dispatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
	useEffect: (callback: (() => void) | void, deps: any[] | void) => void;
	useTransition: () => [boolean, (callback: () => void) => void];
	useRef: <T>(initialValue: T) => { current: T };
}

export type Dispatch<State> = (action: Action<State>) => void;

/**
 * 内部数据共享层
 * react没法做到一个函数能判断是处于什么上下文
 * 因此选择在不同的上下文使用不同的函数，此时需要一个内部数据共享层来共享他们的数据
 */
export const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

/** 判断当前hooks是否在函数组件中执行,不在就抛出错误 */
export const resolveDispatcher = (): Dispatcher => {
	const dispathcer = currentDispatcher.current;

	if (dispathcer === null) {
		throw new Error('hooks 只能在函数组件中执行');
	}

	return dispathcer;
};

export default currentDispatcher;
