import { SafeAreaView } from 'react-native-safe-area-context';
import AdminBugReportsScreen from '@/components/admin/AdminBugReportsScreen';

export default function AdminBugReportsScreenRoute() {
  return (
    <SafeAreaView className="flex-1 bg-warm-50 dark:bg-espresso-900">
      <AdminBugReportsScreen />
    </SafeAreaView>
  );
}
