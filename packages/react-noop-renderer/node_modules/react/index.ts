// React
import { Dispatcher, resolveDispatcher } from './src/currentDispatcher';
import currentDispatcher from './src/currentDispatcher';
import currentBatchConfig from './src/currentBatchConfig';
import { jsx, jsxDEV, isValidElement as isValidElementFn } from './src/jsx';

/**
 * 调用过程：
 * 函数组件中使用useState,即 const [num, setNum] = useState(10)
 * useState -> resolveDispatcher 判断是否处于函数组件内 -> 调用currentDispatcher.current,
 * currentDispatcher.current在renderWithHooks函数中被赋值对应上下文的HooksDispathcer
 */
export const useState: Dispatcher['useState'] = (initialState: any) => {
	const dispathcer = resolveDispatcher();
	return dispathcer.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	const dispathcer = resolveDispatcher();
	return dispathcer.useEffect(create, deps);
};

export const useTransition: Dispatcher['useTransition'] = () => {
	const dispathcer = resolveDispatcher();
	return dispathcer.useTransition();
};

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher,
	currentBatchConfig
};

export const version = '0.0.0';
// 根据环境区分使用jsx/jsxDEV
export const createElement = jsx;
export const isValidElement = isValidElementFn;
