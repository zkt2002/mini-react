// ReactDom.createRoot(root).render(<App/>)

import { Container } from 'hostConfig';
import {
	createContainer,
	updateContainer
} from 'react-reconclier/src/fiberReconciler';
import { ReactElementType } from 'shared/ReactTypes';
import { initEvent } from './SyntheticEvent';

export function createRoot(container: Container) {
	const root = createContainer(container);

	return {
		render(element: ReactElementType) {
			initEvent(container, 'click');
			return updateContainer(element, root);
		}
	};
}
