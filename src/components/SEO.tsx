import { Helmet } from "react-helmet-async";

const BASE_URL = "https://vers.vionevents.com";
const DEFAULT_IMAGE = `${BASE_URL}/Screenshot_2026-03-21_133951.png`;

interface SEOProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: string;
  noindex?: boolean;
  jsonLd?: Record<string, any>;
}

const SEO = ({ title, description, path, image = DEFAULT_IMAGE, type = "website", noindex = false, jsonLd }: SEOProps) => {
  const url = `${BASE_URL}${path}`;
  const fullTitle = path === "/" ? title : `${title} | VERS`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
