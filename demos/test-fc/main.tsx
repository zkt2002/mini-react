import { useState } from 'react';
import ReactDOM from 'react-dom';

// @ts-ignore
console.log(import.meta.hot);

const jsx = (
	<div>
		<span>mini-react</span>
	</div>
);

function App() {
	const [num, setNum] = useState(3);
	// window.setNum = setNum;

	const arr =
		num % 2 === 0
			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
			: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];

	if (num === 5) {
		setNum(3);
	}

	// return num === 3 ? <Child /> : <div>{num}</div>;
	// return <div onClick={() => setNum(num + 1)}>{num}</div>;
	return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>;
}

function Child() {
	return <span>big-react</span>;
}

const root: HTMLElement = document.querySelector('#root') as HTMLElement;
// @ts-ignore
ReactDOM.createRoot(root).render(<App />);

// console.log(React);
console.log(<App />);
console.log(ReactDOM);
