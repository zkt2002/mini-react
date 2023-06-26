import React, { useState } from 'react';
import ReactDOM from 'react-dom';

// @ts-ignore
console.log(import.meta.hot);

const jsx = (
	<div>
		<span>mini-react</span>
	</div>
);

function App() {
	const [num, setNum] = useState(100);
	window.setNum = setNum;
	return <div>{num}</div>;
}

const root: HTMLElement = document.querySelector('#root') as HTMLElement;
// @ts-ignore
ReactDOM.createRoot(root).render(<App />);

console.log(React);
console.log(<App />);
console.log(ReactDOM);
