import { useState, useEffect } from 'react';
// import ReactDOM from 'react-dom';
import * as ReactDOM from 'react-noop-renderer';

// @ts-ignore
console.log(import.meta.hot);

// const jsx = (
// 	<div>
// 		<span>mini-react</span>
// 	</div>
// );

// function App() {
// 	const [num, setNum] = useState(3);
// 	// window.setNum = setNum;

// 	const arr =
// 		num % 2 === 0
// 			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
// 			: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];

// 	return (
// 		<ul
// 			onClickCapture={() => {
// 				setNum((num) => num + 2);
// 				setNum((num) => num - 2);
// 				setNum((num) => num + 2);
// 			}}
// 		>
// 			{num}
// 		</ul>
// 	);

// 	// return (
// 	// 	<>
// 	// 		<div>
// 	// 			<div>123</div>
// 	// 			<div>456</div>
// 	// 		</div>
// 	// 		<div>
// 	// 			<div>123</div>
// 	// 			<div>456</div>
// 	// 		</div>
// 	// 	</>
// 	// );

// 	{
// 		/* <ul onClickCapture={() => setNum(num + 1)}>
// 			<li>5</li>
// 			<li>6</li>
// 			{arr}
// 		</ul> */
// 	}

// 	// return num === 3 ? <Child /> : <div>{num}</div>;
// 	// return <div onClick={() => setNum(num + 1)}>{num}</div>;
// 	// return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>;
// }

// function Child() {
// 	return <span>big-react</span>;
// }

// function App() {
// 	const [num, updateNum] = useState(0);
// 	console.log('app in');
// 	useEffect(() => {
// 		console.warn('mount App');
// 	}, []);

// 	useEffect(() => {
// 		console.warn('num change create', num);

// 		return () => {
// 			console.warn('num change destroy', num);
// 		};
// 	}, [num]);

// 	return (
// 		<div
// 			onClick={(e) => {
// 				updateNum((num) => num + 1);
// 			}}
// 		>
// 			你好
// 			{num === 1 ? 'noop' : <Child />}
// 		</div>
// 	);
// }

// function Child() {
// 	console.log('child in');
// 	useEffect(() => {
// 		console.warn('mount child');

// 		return () => {
// 			console.warn('destroy child');
// 		};
// 	}, []);
// 	return <p>i am child.</p>;
// }

// const root: HTMLElement = document.querySelector('#root') as HTMLElement;
// @ts-ignore
// ReactDOM.createRoot(root).render(<App />);

function App() {
	return (
		<>
			<Child />
			<div>hello world</div>
		</>
	);
}

function Child() {
	return 'Child';
}

const root = ReactDOM.createRoot();
root.render(<App />);
window.root = root;

// console.log(React);
// console.log(<App />);
// console.log(ReactDOM);
