import { useState } from 'react';
import TabButton from './TabButton.jsx';
import AboutTab from './AboutTab.jsx';
import PostsTab from './PostsTab.jsx';
import ContactTab from './ContactTab.jsx';
import ReactDOM from 'react-dom/client';
import './styles.css';

export default function App() {
	const [tab, setTab] = useState('about');

	function selectTab(nextTab) {
		setTab(nextTab);
	}

	return (
		<>
			<TabButton isActive={tab === 'about'} onClick={() => selectTab('about')}>
				About
			</TabButton>
			<TabButton isActive={tab === 'posts'} onClick={() => selectTab('posts')}>
				Posts (slow)
			</TabButton>
			<TabButton
				isActive={tab === 'contact'}
				onClick={() => selectTab('contact')}
			>
				Contact
			</TabButton>
			<hr />
			{tab === 'about' && <AboutTab />}
			{tab === 'posts' && <PostsTab />}
			{tab === 'contact' && <ContactTab />}
		</>
	);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
