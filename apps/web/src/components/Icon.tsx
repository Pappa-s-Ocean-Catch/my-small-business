"use client";

import { ReactElement } from "react";
import type { IconType } from "react-icons";
import * as FaIcons from "react-icons/fa";
import * as Fa6Icons from "react-icons/fa6";
import * as FiIcons from "react-icons/fi";

interface IconProps {
  icon: IconType | string;
  className?: string;
  [key: string]: unknown;
}

const iconMap: Record<string, IconType> = {
  // Font Awesome 5 icons
  FaShoppingCart: FaIcons.FaShoppingCart,
  FaPlus: FaIcons.FaPlus,
  FaMinus: FaIcons.FaMinus,
  FaShoppingBag: FaIcons.FaShoppingBag,
  FaFileInvoice: FaIcons.FaFileInvoice,
  FaBuilding: FaIcons.FaBuilding,
  FaUsers: FaIcons.FaUsers,
  FaBolt: FaIcons.FaBolt,
  FaBullhorn: FaIcons.FaBullhorn,
  FaTools: FaIcons.FaTools,
  FaDollarSign: FaIcons.FaDollarSign,
  FaCreditCard: FaIcons.FaCreditCard,
  FaEdit: FaIcons.FaEdit,
  FaTrash: FaIcons.FaTrash,
  FaTimes: FaIcons.FaTimes,
  FaCheck: FaIcons.FaCheck,
  FaCheckCircle: FaIcons.FaCheckCircle,
  FaExclamationTriangle: FaIcons.FaExclamationTriangle,
  FaInfoCircle: FaIcons.FaInfoCircle,
  FaPrint: FaIcons.FaPrint,
  FaDownload: FaIcons.FaDownload,
  FaUpload: FaIcons.FaUpload,
  FaFileAlt: FaIcons.FaFileAlt,
  FaImage: FaIcons.FaImage,
  FaCamera: FaIcons.FaCamera,
  FaEye: Fa6Icons.FaEye,
  FaEyeSlash: Fa6Icons.FaEyeSlash,
  // Additional icons that might be used
  FaChevronLeft: FaIcons.FaChevronLeft,
  FaChevronRight: FaIcons.FaChevronRight,
  FaCalendar: FaIcons.FaCalendar,
  FaCalendarAlt: FaIcons.FaCalendarAlt,
  FaFilter: FaIcons.FaFilter,
  FaSpinner: FaIcons.FaSpinner,
  FaUtensils: FaIcons.FaUtensils,
  FaArrowRight: FaIcons.FaArrowRight,
  FaPhone: FaIcons.FaPhone,
  FaClock: FaIcons.FaClock,
  FaEnvelope: FaIcons.FaEnvelope,
  FaTags: FaIcons.FaTags,
  FaFileExcel: FaIcons.FaFileExcel,
  FaChartLine: FaIcons.FaChartLine,
  FaChartPie: FaIcons.FaChartPie,
  FaMoneyBillWave: FaIcons.FaMoneyBillWave,
  FaCog: FaIcons.FaCog,
  FaArrowUp: FaIcons.FaArrowUp,
  FaArrowDown: FaIcons.FaArrowDown,
  FaBox: FaIcons.FaBox,
  FaExclamationCircle: FaIcons.FaExclamationCircle,
  FaBell: FaIcons.FaBell,
  FaHistory: FaIcons.FaHistory,
  FaToggleOn: FaIcons.FaToggleOn,
  FaToggleOff: FaIcons.FaToggleOff,
  FaSave: FaIcons.FaSave,
  FaFilePdf: FaIcons.FaFilePdf,
  FaCopy: FaIcons.FaCopy,
  FaFileImport: FaIcons.FaFileImport,
  FaExpand: FaIcons.FaExpand,
  FaCompress: FaIcons.FaCompress,
  FaUser: FaIcons.FaUser,
  FaUserShield: FaIcons.FaUserShield,
  FaUserCog: FaIcons.FaUserCog,
  FaSync: FaIcons.FaSync,
  FaLock: FaIcons.FaLock,
  FaGift: FaIcons.FaGift,
  FaChevronUp: FaIcons.FaChevronUp,
  FaChevronDown: FaIcons.FaChevronDown,
  FaStore: FaIcons.FaStore,
  FaTimesCircle: FaIcons.FaTimesCircle,
  FaSearch: FaIcons.FaSearch,
  FaFire: FaIcons.FaFire,
  FaStar: FaIcons.FaStar,
  FaTruck: FaIcons.FaTruck,
  FaComment: FaIcons.FaComment,
  FaMapMarkerAlt: FaIcons.FaMapMarkerAlt,
  FaRobot: FaIcons.FaRobot,
  FaShieldAlt: FaIcons.FaShieldAlt,
  FaGripVertical: FaIcons.FaGripVertical,
  FaPalette: FaIcons.FaPalette,
  FaTag: FaIcons.FaTag,
  FaTh: FaIcons.FaTh,
  FaList: FaIcons.FaList,
  FaWarehouse: FaIcons.FaWarehouse,
  FaLayerGroup: FaIcons.FaLayerGroup,
  FaMagic: FaIcons.FaMagic,
  FaGoogle: FaIcons.FaGoogle,
  FaBoxOpen: FaIcons.FaBoxOpen,
  FaKey: FaIcons.FaKey,
  FaExternalLinkAlt: FaIcons.FaExternalLinkAlt,
  FaThLarge: FaIcons.FaThLarge,
  FaGlobe: FaIcons.FaGlobe,
  // Feather Icons
  FiCheckCircle: FiIcons.FiCheckCircle,
  FiClock: FiIcons.FiClock,
  FiXCircle: FiIcons.FiXCircle,
  FiShoppingCart: FiIcons.FiShoppingCart,
  FiUser: FiIcons.FiUser,
};

export function Icon({ icon, className = "", ...props }: IconProps): ReactElement {
  // If icon is already a component, render it directly with className
  if (typeof icon !== "string") {
    const IconComponent = icon;
    return (<span className={className}>
        <IconComponent {...props} />
    </span>);
  }

  // If icon is a string, look it up in the icon map
  const IconComponent = iconMap[icon];
  
  if (!IconComponent) {
    // Fallback to a default icon if the icon name is not found
    console.warn(`Icon "${icon}" not found in iconMap. Using FaInfoCircle as fallback.`);
    (<span className={className}>
        <Icon icon={FaIcons.FaInfoCircle} {...props} />
    </span>);

  }

  return (<span className={className}>
    <IconComponent {...props} />
</span>);
}
