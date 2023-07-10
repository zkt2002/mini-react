import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, updateNum] = useState(0);
	const len = 50;

	console.log('num', num);
	return (
		<ul
			onClick={(e) => {
				updateNum((num: number) => num + 1);
			}}
		>
			{Array(len)
				.fill(1)
				.map((_, i) => {
					return <Child i={`${i} ${num}`} key={i} />;
				})}
		</ul>
	);
}

function Child({ i }) {
	const now = performance.now();
	// while (performance.now() - now < 4) {}
	return <p>i am child {i}</p>;
}

const root: HTMLElement = document.querySelector('#root') as HTMLElement;
// @ts-ignore
ReactDOM.createRoot(root).render(<App />);
