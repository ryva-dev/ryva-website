import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { ProtectedLayout } from "./components";
import { AccessPage } from "./pages/AccessPage";
import { AdminPage } from "./pages/AdminPage";
import { CertificationPage } from "./pages/CertificationPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { SubscriptionPage } from "./pages/SubscriptionPage";
import { ImportPage } from "./pages/ImportPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { RecordDetailPage, RecordsPage } from "./pages/RecordsPage";
import { SearchPage } from "./pages/SearchPage";
import { TasksPage } from "./pages/TasksPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SourcesPage } from "./pages/SourcesPage";
import { TerritoriesPage } from "./pages/TerritoriesPage";
import {
  ProductComparisonCreatePage,
  ProductComparisonDetailPage,
  ProductDetailPage,
  ProductRegisterPage
} from "./redesign/product";
import { BrandDetailPage, BrandRegisterPage } from "./redesign/brand";
import { BuyerDetailPage, BuyerRegisterPage } from "./redesign/buyer";
import { ContactDetailPage } from "./redesign/contact";
import {
  AgreementDetailPage,
  RepresentationDetailPage,
  RepresentationRegisterPage
} from "./redesign/representation";
import { PlacementDetailPage, PlacementPage } from "./pages/PlacementPages";
import {
  OutreachDetailPage,
  OutreachPage,
  OutreachSequencesPage,
  OutreachTemplatesPage
} from "./pages/OutreachPages";
import {
  AccountDetailPage,
  AccountsPage,
  CommissionDetailPage,
  CommissionDisputeDetailPage,
  CommissionDisputesPage,
  CommissionsPage,
  OrderDetailPage,
  OrdersPage,
  ProtectedAccountDetailPage,
  ProtectedAccountsPage,
  ReordersPage
} from "./pages/CommercePages";
import { AiCopilotPage, AiSuggestionPage } from "./pages/AiPages";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ExportsPage } from "./pages/ExportsPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/access" element={<AccessPage />} />
            <Route path="/certification" element={<CertificationPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/subscription/activate" element={<SubscriptionPage activation />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/records/:type" element={<RecordsPage />} />
            <Route path="/records/:type/:id" element={<RecordDetailPage />} />
            <Route path="/products" element={<ProductRegisterPage />} />
            <Route path="/products/compare" element={<ProductComparisonCreatePage />} />
            <Route path="/products/comparisons/:comparisonId" element={<ProductComparisonDetailPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/brands" element={<BrandRegisterPage />} />
            <Route path="/brands/:id" element={<BrandDetailPage />} />
            <Route path="/buyers" element={<BuyerRegisterPage />} />
            <Route path="/buyers/:id" element={<BuyerDetailPage />} />
            <Route path="/contacts/:id" element={<ContactDetailPage />} />
            <Route path="/representation" element={<RepresentationRegisterPage />} />
            <Route path="/representation/:id" element={<RepresentationDetailPage />} />
            <Route path="/agreements/:id" element={<AgreementDetailPage />} />
            <Route path="/placements" element={<PlacementPage />} />
            <Route path="/placements/:id" element={<PlacementDetailPage />} />
            <Route path="/outreach" element={<OutreachPage />} />
            <Route path="/outreach/templates" element={<OutreachTemplatesPage />} />
            <Route path="/outreach/sequences" element={<OutreachSequencesPage />} />
            <Route path="/outreach/:id" element={<OutreachDetailPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/protected-accounts" element={<ProtectedAccountsPage />} />
            <Route path="/protected-accounts/:id" element={<ProtectedAccountDetailPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/reorders" element={<ReordersPage />} />
            <Route path="/commissions" element={<CommissionsPage />} />
            <Route path="/commissions/:id" element={<CommissionDetailPage />} />
            <Route path="/commission-disputes" element={<CommissionDisputesPage />} />
            <Route path="/commission-disputes/:id" element={<CommissionDisputeDetailPage />} />
            <Route path="/copilot" element={<AiCopilotPage />} />
            <Route path="/copilot/:suggestionId" element={<AiSuggestionPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/imports" element={<ImportPage />} />
            <Route path="/exports" element={<ExportsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/territories" element={<TerritoriesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
