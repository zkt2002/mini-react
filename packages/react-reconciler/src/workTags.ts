export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText
	| typeof Fragment;

export const FunctionComponent = 0;
/** 只有应用根节点才为HostRoot, 即`<div id='root'></div>` */
export const HostRoot = 3;
export const HostComponent = 5;
export const HostText = 6;
/** 对应fiberNode.tag的属性 */
export const Fragment = 7;
