import {
	DefaultLane,
	InputContinuousLane,
	SyncLane
} from 'react-reconciler/src/fiberLanes';
import { Container } from './hostConfig';
import { Props } from 'shared/ReactTypes';
import { unstable_runWithPriority } from 'scheduler';

export const elementPropsKey = '__props';
const validEventTypeList = ['click'];

type EventCallback = (e: Event) => void;

interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
}

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}

// dom[xxx] = reactElement props
export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

// react事件机制流程： 在渲染页面时initEvent，触发事件时从当前触发事件的元素开始
// 先判断事件的名称，捕获阶段和冒泡阶段需要分开，捕获阶段的事件UNshift到 capture数组中
// 冒泡阶段的事件push进bubble数组中，从而模拟真实dom上的事件机制
export function initEvent(container: Container, eventType: string) {
	if (!validEventTypeList.includes(eventType)) {
		console.warn('当前不支持', eventType, '事件');
		return;
	}

	if (__DEV__) {
		console.log('初始化事件', eventType);
	}
	container.addEventListener(eventType, (e) => {
		dispatchEvent(container, eventType, e);
	});
}

function createSyntheticEvent(e: Event) {
	const syntheticEvent = e as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = e.stopPropagation;

	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			originStopPropagation();
		}
	};

	return syntheticEvent;
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
	const targetElement = e.target;

	if (targetElement === null) {
		console.warn('事件不存在target', e);
		return;
	}
	// console.log(targetElement as DOMElement, container, eventType);

	// 1.收集沿途的事件
	const { bubble, capture } = collectPaths(
		targetElement as DOMElement,
		container,
		eventType
	);
	// 2.构造合成事件
	const se = createSyntheticEvent(e);
	// 3.遍历capture
	triggerEventFlow(capture, se);

	if (!se.__stopPropagation) {
		// 4.遍历bubble
		triggerEventFlow(bubble, se);
	}
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
	// console.log(paths);

	for (let i = 0; i < paths.length; i++) {
		const callback = paths[i];
		unstable_runWithPriority(eventTypeToEventPriority(se.type), () => {
			callback.call(null, se);
		});

		if (se.__stopPropagation) {
			break;
		}
	}
}

function getEventCallbackNameFromEventType(
	evnetType: string
): string[] | undefined {
	return {
		click: ['onClickCapture', 'onClick']
	}[evnetType];
}

function collectPaths(
	targetElement: DOMElement,
	container: Container,
	eventType: string
): Paths {
	const paths: Paths = {
		bubble: [],
		capture: []
	};
	// 收集事件回调是冒泡的顺序
	while (targetElement && targetElement !== container) {
		// 收集
		const elementProps = targetElement[elementPropsKey];
		if (elementProps) {
			// click -> onClick onClickCapture
			const callbackNameList = getEventCallbackNameFromEventType(eventType);
			if (callbackNameList) {
				callbackNameList.forEach((callbackName, i) => {
					const eventCallback = elementProps[callbackName];
					if (eventCallback) {
						if (i === 0) {
							// capture
							paths.capture.unshift(eventCallback);
						} else {
							// bubble
							paths.bubble.push(eventCallback);
						}
					}
				});
			}
		}
		targetElement = targetElement.parentNode as DOMElement;
	}
	console.log(paths);

	return paths;
}

/** 将事件类型转换成对应的优先级 */
const eventTypeToEventPriority = (eventType: string) => {
	switch (eventType) {
		case 'click':
		case 'keydown':
		case 'keyup':
			return SyncLane;
		case 'scroll':
			return InputContinuousLane;
		// TODO 更多事件类型
		default:
			return DefaultLane;
	}
};
