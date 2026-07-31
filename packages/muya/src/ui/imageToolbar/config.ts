import middleIcon from '../../assets/icons/align_center/2.png';
import leftIcon from '../../assets/icons/align_left/2.png';
import rightIcon from '../../assets/icons/align_right/2.png';
import deleteIcon from '../../assets/icons/image_delete/2.png';
import editIcon from '../../assets/icons/imageEdit/2.png';
import inlineIcon from '../../assets/icons/inline_image/2.png';

// Inline rather than a PNG like the icons above: the toolbar recolours icons
// with `drop-shadow(… currentcolor)`, so only the glyph's silhouette matters
// and an SVG avoids shipping another bitmap per pixel density.
const CROP_ICON_SVG
    = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">'
        + '<path d="M5 1h2v18H5zM5 17h18v2H5zM17 5h2v18h-2zM1 5h18v2H1z"/></svg>';
const cropIcon = `data:image/svg+xml;utf8,${encodeURIComponent(CROP_ICON_SVG)}`;

const icons = [
    {
        type: 'edit',
        tooltip: 'Edit Image',
        icon: editIcon,
    },
    {
        type: 'inline',
        tooltip: 'Inline Image',
        icon: inlineIcon,
    },
    {
        type: 'left',
        tooltip: 'Align Left',
        icon: leftIcon,
    },
    {
        type: 'center',
        tooltip: 'Align Center',
        icon: middleIcon,
    },
    {
        type: 'right',
        tooltip: 'Align Right',
        icon: rightIcon,
    },
    {
        type: 'crop',
        tooltip: 'Crop Image',
        icon: cropIcon,
    },
    {
        type: 'delete',
        tooltip: 'Remove Image',
        icon: deleteIcon,
    },
];

export default icons;

export type Icon = typeof icons[number];
