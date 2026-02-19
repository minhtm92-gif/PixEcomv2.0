export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="shrink-0">
      <div className="container-fluid">
        <div className="flex justify-center items-center py-4">
          <span className="text-xs text-muted-foreground/50">
            {year} &copy; PixEcom by Pixelxlab. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
