import type { ReferenceElement } from '@floating-ui/dom';
import type { VNode } from 'snabbdom';
import type Format from '../../block/base/format';
import type { Muya } from '../../index';

import type { ImageToken } from '../../inlineRenderer/types';
import type { Icon } from './config';
import { h, patch } from '../../utils/snabbdom';
import BaseFloat from '../baseFloat';
import icons from './config';
import './index.css';

const defaultOptions = {
    placement: 'top' as const,
    offsetOptions: {
        mainAxis: 10,
        crossAxis: 0,
        alignmentAxis: 0,
    },
    showArrow: false,
};

export class ImageToolBar extends BaseFloat {
    static pluginName = 'imageToolbar';
    private _oldVNode: VNode | null = null;
    private _imageInfo: {
        token: ImageToken;
        imageId: string;
    } | null = null;

    private _icons: Icon[] = icons;
    private _reference: ReferenceElement | null = null;
    private _block: Format | null = null;
    private _toolbarContainer: HTMLDivElement = document.createElement('div');

    constructor(muya: Muya, options = {}) {
        const name = 'mu-image-toolbar';
        const opts = Object.assign({}, defaultOptions, options);

        super(muya, name, opts);

        this.container!.appendChild(this._toolbarContainer);
        this.floatBox!.classList.add('mu-image-toolbar-container');

        this.listen();
    }

    override listen() {
        const { eventCenter } = this.muya;
        super.listen();
        eventCenter.on('muya-image-toolbar', ({ block, reference, imageInfo }) => {
            this._reference = reference;
            if (reference) {
                this._block = block;
                this._imageInfo = imageInfo;
                setTimeout(() => {
                    this.show(reference);
                    this._render();
                }, 0);
            }
            else {
                this.hide();
            }
        });
    }

    /**
     * Cropping needs an embedder that can write the result back to disk, and
     * only makes sense for a local raster image: an SVG has no pixels to cut
     * and a remote image isn't ours to rewrite.
     */
    private _canCrop(): boolean {
        if (!this.muya.options.imageCropAction)
            return false;

        const src = this._imageInfo?.token.attrs.src ?? '';

        return !!src && !/^(?:https?|data):/i.test(src) && !/\.svg(?:[?#].*)?$/i.test(src);
    }

    private _render() {
        const { _oldVNode: oldVNode, _toolbarContainer: toolbarContainer, _imageInfo: imageInfo } = this;
        const { i18n } = this.muya;
        const { attrs } = imageInfo!.token;
        const dataAlign = attrs['data-align'];
        const canCrop = this._canCrop();
        const icons = this._icons.filter(i => i.type !== 'crop' || canCrop);
        const children = icons.map((i) => {
            const iconWrapperSelector = 'div.icon-wrapper';
            const icon = h(
                'i.icon',
                h(
                    'i.icon-inner',
                    {
                        style: {
                            'background': `url(${i.icon}) no-repeat`,
                            'background-size': '100%',
                        },
                    },
                    '',
                ),
            );
            const iconWrapper = h(iconWrapperSelector, icon);
            let itemSelector = `li.item.${i.type}`;

            if (i.type === dataAlign || (!dataAlign && i.type === 'inline'))
                itemSelector += '.active';

            return h(
                itemSelector,
                {
                    dataset: {
                        tip: i.tooltip,
                    },
                    attrs: {
                        title: i18n.t(i.tooltip),
                    },
                    on: {
                        click: (event) => {
                            this._selectItem(event, i);
                        },
                    },
                },
                iconWrapper,
            );
        });

        const vnode = h('ul', children);

        if (oldVNode)
            patch(oldVNode, vnode);
        else
            patch(toolbarContainer, vnode);

        this._oldVNode = vnode;
    }

    private _selectItem(event: Event, item: Icon) {
        event.preventDefault();
        event.stopPropagation();

        const { _imageInfo: imageInfo } = this;

        switch (item.type) {
            // Delete image.
            case 'delete':
                this._block!.deleteImage(imageInfo!);
                // Hide image transformer
                this.muya.eventCenter.emit('muya-transformer', {
                    reference: null,
                });

                return this.hide();

                // Edit image, for example: editor alt and title, replace image.
            case 'edit': {
                const rect = this._reference!.getBoundingClientRect();
                const reference = {
                    getBoundingClientRect() {
                        rect.height = 0;

                        return rect;
                    },
                };
                // Hide image resize bar
                this.muya.eventCenter.emit('muya-transformer', {
                    reference: null,
                });

                this.muya.eventCenter.emit('muya-image-selector', {
                    block: this._block,
                    reference,
                    imageInfo,
                });

                return this.hide();
            }

            case 'crop': {
                const block = this._block!;
                const src = imageInfo!.token.attrs.src ?? '';
                // Hide image resize bar
                this.muya.eventCenter.emit('muya-transformer', {
                    reference: null,
                });
                this.hide();

                this.muya.options
                    .imageCropAction!(src)
                    .then((newSrc) => {
                        // A null result means the user cancelled; an unchanged
                        // src means the crop overwrote the file in place, and
                        // the image element still has to be re-fetched.
                        if (newSrc == null)
                            return;

                        block.updateImage(imageInfo!, 'src', newSrc);
                    })
                    .catch((err) => {
                        console.error('Failed to crop image:', err);
                    });

                return;
            }

            case 'inline':
                // fall through
            case 'left':
                // fall through
            case 'center':
                // fall through
            case 'right': {
                this._block!.updateImage(this._imageInfo!, 'data-align', item.type);

                return this.hide();
            }
        }
    }
}
