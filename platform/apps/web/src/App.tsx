import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { appPath } from "./appBase";
import { ProtectedLayout } from "./components";
import {
  MarketingCurriculumPage,
  MarketingFaqPage,
  MarketingHomePage,
  MarketingHowItWorksPage,
  MarketingLayout,
  MarketingPageShell,
  MarketingProgramPage,
  TermsPage,
  PrivacyPage,
  RefundPolicyPage,
  DisclaimerPage,
  ProgramCheckoutPage,
  SignupPage
} from "./marketing";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MfaSetupPage } from "./pages/MfaSetupPage";
import {
  FinalAssessmentPage,
  FinalSimulationPage,
  ProgramDashboardPage,
  ProgramItemPage,
  ProgramLibraryPage,
  ProgramModulePage
} from "./program/ProgramExperience";
import { CreateAccountPage } from "./marketing/CreateAccountPage";
import { ForgotPasswordPage } from "./marketing/ForgotPasswordPage";
import { ResetPasswordPage } from "./marketing/ResetPasswordPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { RecordDetailPage, RecordsPage } from "./pages/RecordsPage";
import { TasksPage } from "./pages/TasksPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SourcesPage } from "./pages/SourcesPage";
import { TerritoriesPage } from "./pages/TerritoriesPage";
import { AnalyticsWorkspacePage } from "./redesign/analytics";
import { OperationsWorkspacePage } from "./redesign/admin";
import {
  AccessWorkspacePage,
  CertificationWorkspacePage,
  ProfileWorkspacePage,
  SettingsWorkspacePage,
  SubscriptionWorkspacePage
} from "./redesign/settings";
import { ExportReviewPage, ImportReviewPage } from "./redesign/transfer";
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
import { PlacementDetailPage, PlacementRegisterPage } from "./redesign/placement";
import {
  OutreachDetailPage,
  OutreachSequencesPage,
  OutreachTemplatesPage,
  OutreachWorkspacePage
} from "./redesign/outreach";
import {
  AccountDetailPage,
  AccountRegisterPage,
  CommissionDetailPage,
  CommissionRegisterPage,
  DisputeDetailPage,
  DisputeRegisterPage,
  OrderDetailPage,
  OrderRegisterPage,
  ProtectedAccountDetailPage,
  ProtectedAccountRegisterPage,
  ReorderRegisterPage
} from "./redesign/commerce";
import { AiCopilotPage, AiSuggestionPage } from "./pages/AiPages";

/** Legacy bare platform paths → `/app/*` (bookmarks + in-app links not yet rewritten). */
const legacyPlatformRedirects = [
  "/access",
  "/program",
  "/certification",
  "/subscription",
  "/subscription/activate",
  "/profile",
  "/settings",
  "/admin",
  "/products",
  "/products/compare",
  "/brands",
  "/buyers",
  "/representation",
  "/placements",
  "/outreach",
  "/outreach/templates",
  "/outreach/sequences",
  "/accounts",
  "/protected-accounts",
  "/orders",
  "/reorders",
  "/commissions",
  "/commission-disputes",
  "/copilot",
  "/analytics",
  "/tasks",
  "/imports",
  "/exports",
  "/notifications",
  "/documents",
  "/sources",
  "/territories"
] as const;

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route index element={<MarketingHomePage />} />
            <Route path="the-program" element={<MarketingProgramPage />} />
            <Route path="how-it-works" element={<MarketingHowItWorksPage />} />
            <Route path="curriculum" element={<MarketingCurriculumPage />} />
            <Route
              path="who-its-for"
              element={
                <MarketingPageShell
                  title="Who it’s for"
                  lede="For the curious, commercially minded, and ready to understand a world most people never see."
                  cta={{ to: "/signup", label: "Join Ryva" }}
                />
              }
            />
            <Route path="pricing" element={<Navigate to="/signup" replace />} />
            <Route path="faq" element={<MarketingFaqPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="refund-policy" element={<RefundPolicyPage />} />
            <Route path="disclaimer" element={<DisclaimerPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="join" element={<SignupPage />} />
            <Route path="checkout" element={<ProgramCheckoutPage />} />
            <Route path="create-account" element={<CreateAccountPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/mfa-setup" element={<MfaSetupPage />} />

          <Route path="/app" element={<ProtectedLayout />}>
            <Route index element={<AuthenticatedLanding />} />
            <Route path="access" element={<AccessWorkspacePage />} />
            <Route path="program" element={<ProgramDashboardPage />} />
            <Route path="program/library" element={<ProgramLibraryPage />} />
            <Route path="program/final-simulation" element={<FinalSimulationPage />} />
            <Route path="program/final-assessment" element={<FinalAssessmentPage />} />
            <Route path="program/:moduleSlug" element={<ProgramModulePage />} />
            <Route path="program/:moduleSlug/:itemSlug" element={<ProgramItemPage />} />
            <Route path="certification" element={<LegacyCertificationRoute />} />
            <Route path="subscription" element={<SubscriptionWorkspacePage />} />
            <Route path="subscription/activate" element={<SubscriptionWorkspacePage activation />} />
            <Route path="profile" element={<ProfileWorkspacePage />} />
            <Route path="settings" element={<SettingsWorkspacePage />} />
            <Route path="admin" element={<OperationsWorkspacePage />} />
            <Route path="records/:type" element={<RecordsPage />} />
            <Route path="records/:type/:id" element={<RecordDetailPage />} />
            <Route path="products" element={<ProductRegisterPage />} />
            <Route path="products/compare" element={<ProductComparisonCreatePage />} />
            <Route path="products/comparisons/:comparisonId" element={<ProductComparisonDetailPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="brands" element={<BrandRegisterPage />} />
            <Route path="brands/:id" element={<BrandDetailPage />} />
            <Route path="buyers" element={<BuyerRegisterPage />} />
            <Route path="buyers/:id" element={<BuyerDetailPage />} />
            <Route path="contacts/:id" element={<ContactDetailPage />} />
            <Route path="representation" element={<RepresentationRegisterPage />} />
            <Route path="representation/:id" element={<RepresentationDetailPage />} />
            <Route path="agreements/:id" element={<AgreementDetailPage />} />
            <Route path="placements" element={<PlacementRegisterPage />} />
            <Route path="placements/:id" element={<PlacementDetailPage />} />
            <Route path="outreach" element={<OutreachWorkspacePage />} />
            <Route path="outreach/templates" element={<OutreachTemplatesPage />} />
            <Route path="outreach/sequences" element={<OutreachSequencesPage />} />
            <Route path="outreach/:id" element={<OutreachDetailPage />} />
            <Route path="accounts" element={<AccountRegisterPage />} />
            <Route path="accounts/:id" element={<AccountDetailPage />} />
            <Route path="protected-accounts" element={<ProtectedAccountRegisterPage />} />
            <Route path="protected-accounts/:id" element={<ProtectedAccountDetailPage />} />
            <Route path="orders" element={<OrderRegisterPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="reorders" element={<ReorderRegisterPage />} />
            <Route path="commissions" element={<CommissionRegisterPage />} />
            <Route path="commissions/:id" element={<CommissionDetailPage />} />
            <Route path="commission-disputes" element={<DisputeRegisterPage />} />
            <Route path="commission-disputes/:id" element={<DisputeDetailPage />} />
            <Route path="copilot" element={<AiCopilotPage />} />
            <Route path="copilot/:suggestionId" element={<AiSuggestionPage />} />
            <Route path="analytics" element={<AnalyticsWorkspacePage />} />
            <Route path="reports" element={<Navigate to={appPath("/analytics?view=reports")} replace />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="imports" element={<ImportReviewPage />} />
            <Route path="exports" element={<ExportReviewPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="sources" element={<SourcesPage />} />
            <Route path="territories" element={<TerritoriesPage />} />
          </Route>

          <Route path="/reports" element={<Navigate to={appPath("/analytics?view=reports")} replace />} />
          {legacyPlatformRedirects.map((path) => (
            <Route key={path} path={path} element={<Navigate to={appPath(path)} replace />} />
          ))}
          <Route path="/products/*" element={<LegacyAppSplatRedirect base="/products" />} />
          <Route path="/brands/*" element={<LegacyAppSplatRedirect base="/brands" />} />
          <Route path="/buyers/*" element={<LegacyAppSplatRedirect base="/buyers" />} />
          <Route path="/contacts/*" element={<LegacyAppSplatRedirect base="/contacts" />} />
          <Route path="/representation/*" element={<LegacyAppSplatRedirect base="/representation" />} />
          <Route path="/agreements/*" element={<LegacyAppSplatRedirect base="/agreements" />} />
          <Route path="/placements/*" element={<LegacyAppSplatRedirect base="/placements" />} />
          <Route path="/outreach/*" element={<LegacyAppSplatRedirect base="/outreach" />} />
          <Route path="/accounts/*" element={<LegacyAppSplatRedirect base="/accounts" />} />
          <Route path="/protected-accounts/*" element={<LegacyAppSplatRedirect base="/protected-accounts" />} />
          <Route path="/orders/*" element={<LegacyAppSplatRedirect base="/orders" />} />
          <Route path="/commissions/*" element={<LegacyAppSplatRedirect base="/commissions" />} />
          <Route path="/commission-disputes/*" element={<LegacyAppSplatRedirect base="/commission-disputes" />} />
          <Route path="/copilot/*" element={<LegacyAppSplatRedirect base="/copilot" />} />
          <Route path="/records/*" element={<LegacyAppSplatRedirect base="/records" />} />
          <Route path="/subscription/*" element={<LegacyAppSplatRedirect base="/subscription" />} />
          <Route path="/program/*" element={<LegacyAppSplatRedirect base="/program" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AuthenticatedLanding() {
  const { session } = useAuth();
  if (!session) return null;
  if (session.user.role === "admin") {
    return <Navigate to={appPath("/admin")} replace />;
  }
  if (session.user.role === "support") return <Navigate to={appPath("/access")} replace />;
  if (session.access.capabilities.includes("operational:read")) return <HomePage />;
  if (session.access.canAccessProgram) return <Navigate to={appPath("/program")} replace />;
  return <Navigate to={appPath("/access")} replace />;
}

function LegacyCertificationRoute() {
  const { session } = useAuth();
  if (!session) return null;
  return ["admin", "support"].includes(session.user.role)
    ? <CertificationWorkspacePage />
    : <Navigate to={appPath("/access")} replace />;
}

function LegacyAppSplatRedirect({ base }: { base: string }) {
  const location = useLocation();
  const suffix = location.pathname.startsWith(base) ? location.pathname.slice(base.length) : "";
  return <Navigate to={`${appPath(base)}${suffix}${location.search}`} replace />;
}
