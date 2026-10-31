// Blog posts. To add one, copy an entry, give it a new slug (lowercase, dashes),
// and put it first in the list so it shows at the top. Body paragraphs are
// plain strings; a string starting with "## " becomes a subheading.

export const POSTS = [
  {
    slug: "whats-next",
    title: "What's next for EzClass",
    date: "2026-10-30",
    author: "EzClass Team",
    tag: "Roadmap",
    excerpt: "Real SDSU sections, GE filters, and a planner that knows which term you're looking at. Here's what we're working on now.",
    body: [
      "The first version of EzClass ran on made-up sections. That was on purpose. We wanted the database, the API, and the planner to work end to end before we spent time cleaning real data.",
      "## Real sections are loading",
      "The backend now imports real Spring 2027 sections, 559 of them so far. Each one has its course, professor, meeting days, times, and room. The import reads plain CSV files, so adding another term means adding new files, not rewriting code.",
      "## GE filters",
      "A lot of students plan around General Education requirements first and pick major classes second. The backend can already tag courses by GE area. Next, the planner gets a GE filter so you can ask for \"any IV.B course that fits my Tuesday.\"",
      "## Term-aware search",
      "You can already switch between Fall 2026, Spring 2027, and Summer 2027, and each term keeps its own plans. The server side is catching up, so every search only returns sections from the term you picked.",
      "## Testing with real students",
      "Before we call anything finished, we'll sit down with students who are about to register and watch them build a schedule. If someone gets stuck, that's a bug, even if the code is technically working.",
    ],
  },
  {
    slug: "designing-the-planner",
    title: "Building a planner you can learn in a minute",
    date: "2026-10-19",
    author: "EzClass Team",
    tag: "Design",
    excerpt: "Why the planner shows your week the whole time, why red always means \"problem\", and why there's no login.",
    body: [
      "Most class search tools give you a list. You read it, write down section numbers, then try to picture your week in your head. We wanted the week to be on screen from the first click.",
      "## Your week is always visible",
      "The planner has three parts side by side: filters, the list of sections, and your week. When you hover over a section, a dashed outline shows where it would land. You see the problem before you add anything.",
      "## Red only means one thing",
      "We use SDSU red for two jobs: buttons that do something, and anything that's wrong. An overlap turns red. A class that runs into your work shift turns red. Everything else, like each subject's color, uses calmer colors, so a problem stands out right away.",
      "## No account",
      "Your plans save in your own browser. There's nothing to sign up for and no password to forget. If you want to send your week to a friend or an advisor, the share link carries the section numbers, and opening it rebuilds the same week.",
      "## Plain web code",
      "The frontend is plain HTML, CSS, and JavaScript with no framework. It loads fast, works on phones, and anyone on the team can open a file and understand it.",
    ],
  },
  {
    slug: "how-conflict-check-works",
    title: "How EzClass spots a time conflict",
    date: "2026-10-05",
    author: "EzClass Team",
    tag: "Engineering",
    excerpt: "Two classes clash when they share a day and their times overlap. Getting that right takes more care than you'd think.",
    body: [
      "On paper, a conflict check is simple: two classes clash if they meet on the same day at overlapping times. In practice, the details are where it goes wrong.",
      "## The rule",
      "Class A and class B overlap when they share at least one meeting day, A starts before B ends, and B starts before A ends. That last pair of comparisons catches every case, including one class sitting completely inside another.",
      "## Day codes are messy",
      "Schedule data writes Thursday in more than one way. Some rows say \"TTh\" and others say \"TR\". If the check treats those differently, a Tuesday-Thursday class can slip past another one. EzClass turns every pattern into the same list of days before it compares anything.",
      "## Back-to-back is fine",
      "A class that ends at 10:45 and another that starts at 10:45 don't overlap. They're tight, though, so the planner flags classes 15 minutes apart in different buildings as a \"tight walk\" instead of a conflict.",
      "## Your own busy times",
      "You can drag across the calendar to block off work or practice. Those blocks go through the same overlap rule, so a class that runs into your shift is flagged the same way as a class that runs into another class.",
    ],
  },
  {
    slug: "why-we-started",
    title: "Why we started EzClass",
    date: "2026-09-21",
    author: "EzClass Team",
    tag: "Our story",
    excerpt: "Registration week shouldn't mean juggling browser tabs, a group chat, and last year's screenshot. We're students, and we built the tool we wanted.",
    body: [
      "Every semester the same thing happens. Registration opens, and suddenly you have the class search in one tab, professor reviews in another, a notes app full of times, and a group chat asking whether a section is full.",
      "Then you find out two of your classes overlap on Wednesdays. Usually after you've already registered for one of them.",
      "## Students building for students",
      "EzClass started at San Diego State with six of us who were tired of planning that way. We're students, and we're the people this tool is for. We know what it's like to plan around a part-time job, a long commute, or a class that only has one section.",
      "## What we set out to build",
      "One screen where you can search sections, see your whole week, and know right away if anything clashes. No account, no clutter, and nothing to install.",
      "## Where we are",
      "The database, the API, and the planner are built and working together. We're loading real SDSU sections now. This blog is where we'll post what we're building and what we learn along the way.",
    ],
  },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function readMinutes(post) {
  const words = post.body.join(" ").split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}
