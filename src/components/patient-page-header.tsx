import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PatientPageHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand-lockup" href="/" aria-label="ENT-Care home">
          <Image
            src="/aap-logo-img.png"
            alt="Abraham Adesanya Polytechnic"
            width={212}
            height={68}
            priority
          />
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-name">ENT-Care</span>
        </Link>
        <nav className="site-nav" aria-label="Patient navigation">
          <Link href="/">Explore anatomy</Link>
          <Link href="/hospitals">Find care</Link>
          <Link href="/report">Look up a report</Link>
          <a className="ambulance-link" href="tel:08112000033">
            Ambulance 08112000033
          </a>
          <Link className="header-action" href="/">
            Back to home <ArrowLeft aria-hidden="true" size={15} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
