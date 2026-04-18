import { createLazyFileRoute } from '@tanstack/react-router';
import { InputVideosPage } from '../-components/InputVideosPage';

export const Route = createLazyFileRoute('/video-api-studio/input-videos/')({
    component: InputVideosPage,
});
