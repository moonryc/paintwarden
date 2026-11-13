import AccessibilityNewOutlinedIcon from "@mui/icons-material/AccessibilityNewOutlined";
import AddIcon from "@mui/icons-material/Add";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BookmarksOutlinedIcon from "@mui/icons-material/BookmarksOutlined";
import BrushOutlinedIcon from "@mui/icons-material/BrushOutlined";
import CheckIcon from "@mui/icons-material/Check";
import ChecklistIcon from "@mui/icons-material/Checklist";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import ColorizeOutlinedIcon from "@mui/icons-material/ColorizeOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import HideImageOutlinedIcon from "@mui/icons-material/HideImageOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import MenuMuiIcon from "@mui/icons-material/Menu";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpacityOutlinedIcon from "@mui/icons-material/OpacityOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import RefreshIcon from "@mui/icons-material/Refresh";
import RemoveIcon from "@mui/icons-material/Remove";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import UploadOutlinedIcon from "@mui/icons-material/UploadOutlined";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import type { ComponentType } from "react";

export type AppIconProps = Omit<SvgIconProps, "fontSize"> & { size?: number | string; strokeWidth?: number };

export const appIcon = (Icon: ComponentType<SvgIconProps>) =>
  function AppIcon({ size, strokeWidth: _strokeWidth, style, ...props }: AppIconProps) {
    return <Icon {...props} style={{ fontSize: size, ...style }} />;
  };

export const Archive = appIcon(Inventory2OutlinedIcon),
  ArrowLeftRight = appIcon(SwapHorizIcon),
  Bookmarks = appIcon(BookmarksOutlinedIcon),
  Eyedropper = appIcon(ColorizeOutlinedIcon),
  PaintDrop = appIcon(OpacityOutlinedIcon),
  Palette = appIcon(PaletteOutlinedIcon),
  Figure = appIcon(AccessibilityNewOutlinedIcon),
  TemplateCopy = appIcon(ContentCopyOutlinedIcon),
  Check = appIcon(CheckIcon),
  ChevronDown = appIcon(ExpandMoreIcon),
  ChevronRight = appIcon(ChevronRightIcon),
  CircleDashed = appIcon(RadioButtonUncheckedIcon),
  Download = appIcon(DownloadIcon),
  Ellipsis = appIcon(MoreHorizIcon),
  Extension = appIcon(ExtensionOutlinedIcon),
  ExternalLink = appIcon(OpenInNewIcon),
  FileUp = appIcon(UploadFileIcon),
  FlaskConical = appIcon(ScienceOutlinedIcon),
  Fullscreen = appIcon(FullscreenIcon),
  GripVertical = appIcon(DragIndicatorIcon),
  ImageMinus = appIcon(HideImageOutlinedIcon),
  ImagePlus = appIcon(AddPhotoAlternateOutlinedIcon),
  Layers = appIcon(LayersOutlinedIcon),
  LayoutDashboard = appIcon(DashboardOutlinedIcon),
  ListChecks = appIcon(ChecklistIcon),
  MenuIcon = appIcon(MenuMuiIcon),
  Minus = appIcon(RemoveIcon),
  PackageCheck = appIcon(InventoryOutlinedIcon),
  Paintbrush = appIcon(BrushOutlinedIcon),
  Pencil = appIcon(EditOutlinedIcon),
  Plus = appIcon(AddIcon),
  RotateCw = appIcon(RefreshIcon),
  Save = appIcon(SaveOutlinedIcon),
  Search = appIcon(SearchIcon),
  SearchX = appIcon(SearchOffIcon),
  Settings = appIcon(SettingsOutlinedIcon),
  Share2 = appIcon(ShareOutlinedIcon),
  Sparkles = appIcon(AutoAwesomeOutlinedIcon),
  Trash2 = appIcon(DeleteOutlineIcon),
  Upload = appIcon(UploadOutlinedIcon),
  X = appIcon(CloseIcon),
  ZoomIn = appIcon(ZoomInIcon),
  ZoomOut = appIcon(ZoomOutIcon);

export function Heart({ size, strokeWidth: _strokeWidth, fill, style, ...props }: AppIconProps) {
  const Icon = fill && fill !== "none" ? FavoriteIcon : FavoriteBorderIcon;
  return <Icon {...props} style={{ fontSize: size, ...style }} />;
}
