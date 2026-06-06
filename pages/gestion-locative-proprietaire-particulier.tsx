import SeoLandingPage from "../components/SeoLandingPage";
import { getSeoLandingPage } from "../lib/seoLandingPages";

export default function Page() {
  return <SeoLandingPage page={getSeoLandingPage("gestion-locative-proprietaire-particulier")!} />;
}
