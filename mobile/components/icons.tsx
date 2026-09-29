// Single import point for the Lucide icons the app renders.
//
// `lucide-react-native` re-exports all ~1,700 icons from its package root.
// Together with Expo's graph optimization (`EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH`
// + `EXPO_UNSTABLE_TREE_SHAKING`, pinned in
// `scripts/mobile/expo-export-web.mjs`) this explicit list is what lets the web
// export drop the unused icons from the entry chunk; a direct package import
// keeps every one of them (~1.2 MB raw).
//
// Add a new icon to this list first, then import it from '@/components/icons'
// instead of 'lucide-react-native'.
//
// Note: AlertCircle, CheckCircle, CheckCircle2, CheckSquare, Edit, HelpCircle
// and Home are deprecated lucide aliases, exported here under their old names
// for the call sites that already use them (CircleAlert, CircleCheckBig,
// CircleCheck, SquareCheckBig, SquarePen, CircleQuestionMark, House). They still
// resolve today; renaming them is a separate, purely cosmetic follow-up.
export {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bug,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flame,
  FolderOpen,
  FolderPlus,
  Globe,
  Heart,
  HelpCircle,
  Home,
  ImagePlus,
  Info,
  Key,
  KeyRound,
  LayoutGrid,
  List,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Map,
  Minus,
  Moon,
  Pencil,
  Plus,
  QrCode,
  RefreshCcw,
  RefreshCw,
  Refrigerator,
  RotateCcw,
  RotateCw,
  Save,
  ScrollText,
  Search,
  Send,
  Server,
  Settings,
  Share2,
  Shield,
  ShoppingCart,
  Square,
  Star,
  Sun,
  Tag,
  Thermometer,
  Trash2,
  Type,
  User,
  UserPlus,
  UserRound,
  Users,
  UtensilsCrossed,
  WifiOff,
  Wind,
  X,
} from 'lucide-react-native';
