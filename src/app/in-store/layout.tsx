import { SnackbarProvider } from "@/components/Snackbar";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function InStoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="in-store-layout">
      <SnackbarProvider>
        <main>{children}</main>
        <ToastContainer position="top-right" autoClose={3500} hideProgressBar theme="colored"/>
      </SnackbarProvider>
    </div>
  );
}
