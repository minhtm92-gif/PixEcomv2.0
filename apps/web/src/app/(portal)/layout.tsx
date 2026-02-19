'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const body = document.body.classList;
    body.add('demo1', 'sidebar-fixed', 'header-fixed');

    const timer = setTimeout(() => body.add('layout-initialized'), 300);

    return () => {
      body.remove('demo1', 'sidebar-fixed', 'header-fixed', 'layout-initialized');
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <Sidebar />
      <div className="wrapper flex grow flex-col lg:[&_.container-fluid]:px-8">
        <Header />
        <main className="grow pt-4 lg:pt-6 pb-6">{children}</main>
        <Footer />
      </div>
    </>
  );
}
