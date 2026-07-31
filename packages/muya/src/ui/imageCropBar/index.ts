import type Format from '../../block/base/format';
import type { Muya } from '../../index';
import type { ImageToken } from '../../inlineRenderer/types';
import type { ICropRect } from '../../types';
import { autoUpdate } from '@floating-ui/dom';
import { isHTMLElement, isMouseEvent } from '../../utils';
import './index.css';

interface IImageInfo {
    token: ImageToken;
    imageId: string;
}

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type HandleName = typeof HANDLES[number] | 'move';

/** Smallest crop, in displayed pixels — below this the handles overlap. */
const MIN_SIZE = 24;

/**
 * Crops an image in place, with a draggable frame over the picture itself
 * rather than in a dialog. Modelled on the resize bar: an overlay pinned to the
 * image, kept in position by `autoUpdate`.
 *
 * Unlike resizing, applying is explicit. A resize writes an attribute and is
 * trivially undone; a crop writes a file, and dragging four edges in turn would
 * otherwise crop the crop three times over.
 */
export class ImageCropBar {
    static pluginName = 'imageCropBar';

    private _block: Format | null = null;
    private _imageInfo: IImageInfo | null = null;
    private _image: HTMLElement | null = null;
    private _status = false;
    private _cleanup: (() => void) | null = null;
    private _eventIds: string[] = [];

    /** Live crop frame, in pixels relative to the image's top-left corner. */
    private _rect = { x: 0, y: 0, width: 0, height: 0 };
    private _dragFrom: { x: number; y: number } | null = null;
    private _dragRect = { x: 0, y: 0, width: 0, height: 0 };
    private _dragHandle: HandleName | null = null;

    private _container: HTMLDivElement;
    private _actions: HTMLDivElement;

    constructor(public muya: Muya) {
        this._container = document.createElement('div');
        this._container.classList.add('mu-image-crop');
        this._actions = document.createElement('div');
        this._actions.classList.add('mu-image-crop-actions');
        this._build();
        this._listen();
    }

    private _build() {
        for (const side of ['top', 'right', 'bottom', 'left']) {
            const shade = document.createElement('div');
            shade.classList.add('shade', side);
            this._container.appendChild(shade);
        }

        const frame = document.createElement('div');
        frame.classList.add('frame');
        frame.setAttribute('data-handle', 'move');
        for (const name of HANDLES) {
            const handle = document.createElement('div');
            handle.classList.add('handle', name);
            handle.setAttribute('data-handle', name);
            frame.appendChild(handle);
        }
        this._container.appendChild(frame);

        const { i18n } = this.muya;
        const crop = document.createElement('button');
        crop.classList.add('primary');
        crop.textContent = i18n.t('Crop');
        crop.addEventListener('click', this._apply);

        const cancel = document.createElement('button');
        cancel.textContent = i18n.t('Cancel');
        cancel.addEventListener('click', () => this.hide());

        this._actions.append(crop, cancel);
    }

    private _listen() {
        const { eventCenter } = this.muya;

        eventCenter.on('muya-image-crop-bar', ({ block, reference, imageInfo }) => {
            if (!reference) {
                this.hide();

                return;
            }
            this._block = block;
            this._imageInfo = imageInfo;
            this._image = reference;
            this._show();
        });

        eventCenter.attachDOMEvent(document.body, 'mousedown', this._mouseDown);
        eventCenter.attachDOMEvent(document, 'keydown', this._keyDown);
    }

    private _keyDown = (event: Event) => {
        if (!this._status || !(event instanceof KeyboardEvent))
            return;
        if (event.key === 'Escape')
            this.hide();
        else if (event.key === 'Enter')
            this._apply();
    };

    private _show() {
        if (this._status)
            this.hide();

        this._status = true;
        document.body.appendChild(this._container);
        document.body.appendChild(this._actions);

        const rect = this._image!.getBoundingClientRect();
        this._rect = { x: 0, y: 0, width: rect.width, height: rect.height };
        this._cleanup = autoUpdate(this._image!, this._container, () => this._update());
        this._update();
    }

    hide() {
        if (!this._status)
            return;

        this._status = false;
        this._cleanup?.();
        this._cleanup = null;
        this._container.remove();
        this._actions.remove();
        this._block = null;
        this._imageInfo = null;
        this._image = null;
    }

    /** Reposition the overlay over the image and lay the frame out inside it. */
    private _update() {
        if (!this._image)
            return;

        const bounds = this._image.getBoundingClientRect();
        // The frame is clamped on every update, not only on drag, so a window
        // resize cannot leave it hanging outside the picture.
        this._rect.width = Math.min(this._rect.width, bounds.width);
        this._rect.height = Math.min(this._rect.height, bounds.height);
        this._rect.x = Math.min(Math.max(this._rect.x, 0), bounds.width - this._rect.width);
        this._rect.y = Math.min(Math.max(this._rect.y, 0), bounds.height - this._rect.height);

        Object.assign(this._container.style, {
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
        });

        const { x, y, width, height } = this._rect;
        const frame = this._container.querySelector<HTMLElement>('.frame')!;
        Object.assign(frame.style, {
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`,
        });

        const shade = (side: string, style: Partial<CSSStyleDeclaration>) => {
            Object.assign(
                this._container.querySelector<HTMLElement>(`.shade.${side}`)!.style,
                style,
            );
        };
        shade('top', { left: '0px', top: '0px', width: '100%', height: `${y}px` });
        shade('bottom', {
            left: '0px',
            top: `${y + height}px`,
            width: '100%',
            height: `${Math.max(bounds.height - y - height, 0)}px`,
        });
        shade('left', { left: '0px', top: `${y}px`, width: `${x}px`, height: `${height}px` });
        shade('right', {
            left: `${x + width}px`,
            top: `${y}px`,
            width: `${Math.max(bounds.width - x - width, 0)}px`,
            height: `${height}px`,
        });

        for (const name of HANDLES) {
            const handle = this._container.querySelector<HTMLElement>(`.handle.${name}`)!;
            const left = name.includes('w') ? 0 : name.includes('e') ? width : width / 2;
            const top = name.includes('n') ? 0 : name.includes('s') ? height : height / 2;
            handle.style.left = `${left - 6}px`;
            handle.style.top = `${top - 6}px`;
        }

        Object.assign(this._actions.style, {
            left: `${bounds.left + bounds.width - this._actions.offsetWidth}px`,
            top: `${bounds.top + bounds.height + 6}px`,
        });
    }

    private _mouseDown = (event: Event) => {
        if (!this._status || !isHTMLElement(event.target) || !isMouseEvent(event))
            return;

        const handle = event.target.closest<HTMLElement>('[data-handle]');
        if (!handle) {
            // A click anywhere else — including back on the image — cancels,
            // matching how the other image tools dismiss.
            if (!this._actions.contains(event.target))
                this.hide();

            return;
        }

        event.preventDefault();
        this._dragHandle = handle.getAttribute('data-handle') as HandleName;
        this._dragFrom = { x: event.clientX, y: event.clientY };
        this._dragRect = { ...this._rect };

        const { eventCenter } = this.muya;
        this._eventIds.push(
            eventCenter.attachDOMEvent(document.body, 'mousemove', this._mouseMove),
            eventCenter.attachDOMEvent(document.body, 'mouseup', this._mouseUp),
        );
    };

    private _mouseMove = (event: Event) => {
        if (!isMouseEvent(event) || !this._dragFrom || !this._image)
            return;

        event.preventDefault();
        const bounds = this._image.getBoundingClientRect();
        const dx = event.clientX - this._dragFrom.x;
        const dy = event.clientY - this._dragFrom.y;
        const start = this._dragRect;
        const handle = this._dragHandle!;

        if (handle === 'move') {
            this._rect.x = Math.min(Math.max(start.x + dx, 0), bounds.width - start.width);
            this._rect.y = Math.min(Math.max(start.y + dy, 0), bounds.height - start.height);
        }
        else {
            // Each edge moves independently, clamped so it can neither leave the
            // picture nor cross the opposite edge.
            let { x, y, width, height } = start;
            if (handle.includes('w')) {
                const nextX = Math.min(Math.max(start.x + dx, 0), start.x + start.width - MIN_SIZE);
                width = start.x + start.width - nextX;
                x = nextX;
            }
            if (handle.includes('e'))
                width = Math.min(Math.max(start.width + dx, MIN_SIZE), bounds.width - start.x);

            if (handle.includes('n')) {
                const nextY = Math.min(Math.max(start.y + dy, 0), start.y + start.height - MIN_SIZE);
                height = start.y + start.height - nextY;
                y = nextY;
            }
            if (handle.includes('s'))
                height = Math.min(Math.max(start.height + dy, MIN_SIZE), bounds.height - start.y);

            this._rect = { x, y, width, height };
        }

        this._update();
    };

    private _mouseUp = () => {
        const { eventCenter } = this.muya;
        for (const id of this._eventIds)
            eventCenter.detachDOMEvent(id);

        this._eventIds = [];
        this._dragFrom = null;
        this._dragHandle = null;
    };

    private _apply = () => {
        const { imageCropAction } = this.muya.options;
        const block = this._block;
        const imageInfo = this._imageInfo;
        const image = this._image;
        if (!imageCropAction || !block || !imageInfo || !image)
            return this.hide();

        const bounds = image.getBoundingClientRect();
        const rect: ICropRect = {
            x: this._rect.x / bounds.width,
            y: this._rect.y / bounds.height,
            width: this._rect.width / bounds.width,
            height: this._rect.height / bounds.height,
        };
        const src = imageInfo.token.src || imageInfo.token.attrs?.src || '';
        this.hide();

        // A frame still covering the whole picture would rewrite the file for
        // no change.
        if (rect.width > 0.999 && rect.height > 0.999)
            return;

        imageCropAction(src, rect)
            .then((newSrc) => {
                if (newSrc != null)
                    block.updateImage(imageInfo, 'src', newSrc);
            })
            .catch((err) => {
                console.error('Failed to crop image:', err);
            });
    };
}

export default ImageCropBar;
