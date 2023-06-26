// ReactDom.createRoot(root).render(<App/>)

import { Container } from 'hostConfig';
import {
	createContainer,
	updateContainer
} from 'react-reconclier/src/fiberReconciler';
import { ReactElementType } from 'shared/ReactTypes';

export function createRoot(container: Container) {
	const root = createContainer(container);

	return {
		render(element: ReactElementType) {
			return updateContainer(element, root);
		}
	};
}
