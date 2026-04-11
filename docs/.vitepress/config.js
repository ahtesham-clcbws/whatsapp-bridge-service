export default {
  title: "WhatsApp Bridge Service",
  description: "A generic, headless, and modular WhatsApp to HTTP bridge service.",
  base: "/whatsapp-bridge-service/",
  head: [
    ['link', { rel: 'icon', href: '/whatsapp-bridge-service/favicon.png' }]
  ],
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: "Home", link: "/" },
      { text: "The Vision", link: "/vision" },
      { text: "API Reference", link: "/api" },
      { text: "Session", link: "/session" },
      { text: "Admin Panel", link: "/admin-panel" },
      { text: "History", link: "/changelogs/v3.7.0" },
      { text: "Deployment", link: "/deployment" },
      { text: "Acknowledgements", link: "/acknowledgments" }
    ],
    sidebar: [
      {
        text: "Documentation",
        items: [
          { text: "Getting Started", link: "/" },
          { text: "The Vision", link: "/vision" },
          { text: "API Guide", link: "/api" },
          { text: "API Client Testing", link: "/api-testing" },
          { text: "Remote Session", link: "/session" },
          { text: "Admin Panel Guide", link: "/admin-panel" },
          { text: "24/7 Deployment", link: "/deployment" },
          { text: "Acknowledgements", link: "/acknowledgments" }
        ]
      },
      {
        text: "Project History",
        items: [
          { text: "v3.7.0 (Latest)", link: "/changelogs/v3.7.0" },
          { text: "v3.0.0", link: "/changelogs/v3.0.0" },
          { text: "v2.4.0", link: "/changelogs/v2.4.0" },
          { text: "v2.3.0", link: "/changelogs/v2.3.0" },
          { text: "v2.2.0", link: "/changelogs/v2.2.0" },
          { text: "v2.1.0", link: "/changelogs/v2.1.0" },
          { text: "v2.0.0", link: "/changelogs/v2.0.0" },
          { text: "v1.x Series", link: "/changelogs/v1.3.0" }
        ]
      }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/ahtesham-clcbws/whatsapp-bridge-service" }
    ]
  }
}
