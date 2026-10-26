import { useLocalSearchParams, useRouter } from 'expo-router';
import { OrderDetailController } from '../components/OrderDetailController';

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  return <OrderDetailController orderId={orderId} onClose={() => router.back()} renderInModal={false} />;
}
