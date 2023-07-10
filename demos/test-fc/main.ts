import {
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_LowPriority as LowPriority,
	unstable_IdlePriority as IdlePriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield as shouldYield,
	CallbackNode,
	unstable_getFirstCallbackNode as getFirstCallbackNode,
	unstable_cancelCallback as cancelCallback
} from 'scheduler';
const root = document.querySelector('#root');

type Priority =
	| typeof ImmediatePriority
	| typeof UserBlockingPriority
	| typeof NormalPriority
	| typeof LowPriority
	| typeof IdlePriority;

interface Work {
	count: number;
	priority: Priority;
}
let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null;

const workList: Work[] = [];
[ImmediatePriority, UserBlockingPriority, NormalPriority, LowPriority].forEach(
	(priority) => {
		const btn = document.createElement('button');
		root?.appendChild(btn);
		btn.innerText = [
			'',
			'ImmediatePriority',
			'UserBlockingPriority',
			'NormalPriority',
			'LowPriority'
		][priority];

		btn.onclick = () => {
			workList.unshift({
				count: 100,
				priority: priority as Priority
			});
			schedule();
		};
	}
);

function schedule() {
	// 当前可能存在正在调度的回调
	const cbNode = getFirstCallbackNode();
	// 取出优先级最高的work
	const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];

	// 策略逻辑
	if (!curWork) {
		//没有work需要执行跳出调度
		// 当前任务队列为空，重置
		curCallback = null;
		cbNode && cancelCallback(cbNode);
		return;
	}

	const { priority: curPriority } = curWork;
	// 如果有work，则比较该work与正在进行的work的优先级
	// 如果优先级相同，则继续执行之前的work，退出调度
	if (curPriority === prevPriority) {
		return;
	}

	// 走到这个逻辑代表现在的任务优先级比之前的任务优先级要高
	// 准备调度当前优先级最高的work
	// 调度之前如果有work正在进行，则中断他
	cbNode && cancelCallback(cbNode);

	curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

//执行具体的work
function perform(work: Work, didTimeout?: boolean) {
	/**
	 * 哪些情况可以影响中断
	 * 1. work.priority，高优先级打断低优先级
	 * 2. 饥饿问题，防止低优先级一直无法执行，每次循环都会提升他的优先级，当他过期时
	 * 把它的优先级设为同步优先级
	 * 3. 时间切片,当前时间切片时间用尽，打断任务，下一次再继续执行该任务
	 */
	const needSync = work.priority === ImmediatePriority || didTimeout;
	while ((needSync || !shouldYield()) && work.count) {
		work.count--;
		insertSpan(work.priority + '');
	}

	// 接下来的逻辑是 中断执行 || 执行完
	prevPriority = work.priority;
	// work执行完后从worklist中移除
	if (!work.count) {
		const index = workList.indexOf(work);
		workList.splice(index, 1);
		prevPriority = IdlePriority;
	}

	const prevCallback = curCallback;
	// 调度完成后，如果callback发生变化，说明这是新的work
	schedule();
	const newCallback = curCallback;

	if (newCallback && prevCallback === newCallback) {
		// Callback没变，代表是同一个work，只不过时间切片时间耗尽(5ms)
		// 返回的函数会被Scheduler 继续调用
		return perform.bind(null, work);
	}
}

function insertSpan(content) {
	const span = document.createElement('span');
	span.innerText = content;
	span.className = `pri-${content}`;
	doSomeBuzyWork(10000000);
	root?.appendChild(span);
}

function doSomeBuzyWork(len: number) {
	let res = 0;
	while (len--) {
		res += len;
	}
}
