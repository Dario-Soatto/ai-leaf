'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
    {
    id: 1,
    question: "How much does this cost?",
    answer: "It's COMPLETELY FREE for now. There is no catch."
    },
  {
    id: 2,
    question: "How is this different from Overleaf?",
    answer: "Overleaf's AI features are unreliable, unintuitive, and unuseful (not to mention paywalled). This platform is an AI-first experience where you can directly generate and edit LaTeX from a chatbot interface."
  },
  {
    id: 3,
    question: "Do I need to know LaTeX to use this?",
    answer: "Not at all! The point of this platform is to democratize LaTeX. Just describe what you want, and the AI will generate the proper LaTeX code."
  },
  {
    id: 4,
    question: "Is my data secure?",
    answer: "Yes. All documents are stored securely, only accessible to you, and never shared with third parties."
  },
  {
    id: 5,
    question: "Can I export my documents?",
    answer: "Absolutely. You can download your compiled PDF at any time, and your LaTeX source code is always accessible for export."
  },
  {
    id: 6,
    question: "Who made this?",
    answer: "This was made by a single developer based in the US."
  }
];

export default function FAQSection() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggleFAQ = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="divide-y divide-border">
      {faqs.map((faq) => (
        <div key={faq.id} className="py-4">
          <button
            onClick={() => toggleFAQ(faq.id)}
            className="w-full flex items-center justify-between text-left group"
          >
            <span className="text-lg font-medium group-hover:text-primary transition-colors pr-8">
              {faq.question}
            </span>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ${
                openId === faq.id ? 'rotate-180' : ''
              }`}
            />
          </button>
          
          {openId === faq.id && (
            <div className="mt-4 text-muted-foreground leading-relaxed">
              {faq.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}