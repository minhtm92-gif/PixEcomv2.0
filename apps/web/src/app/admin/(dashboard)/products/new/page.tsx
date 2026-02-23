'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

const SIZES = ['S', 'M', 'L'];
const COLORS = ['Black', 'White'];

const VARIANT_ROWS = SIZES.flatMap((size) =>
  COLORS.map((color) => ({
    key: `${size}/${color}`,
    variant: `${size} / ${color}`,
    price: '59.99',
    compared: '99.99',
    cost: '18.50',
    fulfillment: '4.50',
    sku: `SKU-${size}-${color.toUpperCase().slice(0, 3)}`,
  })),
);

export default function NewProductPage() {
  const [name, setName] = useState('');

  return (
    <PageShell
      icon={<Package size={20} className="text-amber-400" />}
      backHref="/admin/products"
      backLabel="Products"
      title="Add New Product"
      actions={
        <>
          <button className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
            Discard
          </button>
          <button
            disabled
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium opacity-60 cursor-default"
          >
            Create Product
          </button>
        </>
      }
    >
      {/* Section 1: Product Information */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Product Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Title / Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder="Product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Support Email</label>
            <input type="email" className={inputCls} placeholder="support@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              rows={3}
              className={inputCls}
              placeholder="Enter product description..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tags</label>
            <input type="text" className={inputCls} placeholder="Press Enter to add tags" />
          </div>
        </div>
      </div>

      {/* Section 2: Images */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Images</h2>
        <div className="border-2 border-dashed border-border rounded-lg h-40 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">Drag &amp; drop images here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Accepts JPG, PNG, GIF</p>
        </div>
        <button
          disabled
          className="mt-4 px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium opacity-60 cursor-default"
        >
          Add images
        </button>
      </div>

      {/* Section 3: Variants */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Variants</h2>

        {/* Option groups */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs text-muted-foreground mb-2">Option</label>
            <div className="flex items-center gap-3">
              <input type="text" value="Size" readOnly className={inputCls + ' max-w-[120px]'} />
              <div className="flex gap-2 flex-wrap">
                {SIZES.map((s) => (
                  <span
                    key={s}
                    className="bg-muted rounded-full px-3 py-1 text-xs text-foreground font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <input type="text" value="Color" readOnly className={inputCls + ' max-w-[120px]'} />
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <span
                    key={c}
                    className="bg-muted rounded-full px-3 py-1 text-xs text-foreground font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button disabled className="text-sm text-amber-400 opacity-60 cursor-default">
            + Add option
          </button>
        </div>

        {/* Preview table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider w-8">
                  <input type="checkbox" disabled className="accent-amber-500" />
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Variant
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                  Image
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Price ($)
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Compared ($)
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Cost ($)
                </th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Fulfillment ($)
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  SKU
                </th>
              </tr>
            </thead>
            <tbody>
              {VARIANT_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2">
                    <input type="checkbox" disabled className="accent-amber-500" />
                  </td>
                  <td className="px-3 py-2 text-foreground font-medium">{row.variant}</td>
                  <td className="px-3 py-2">
                    <div className="w-8 h-8 bg-muted rounded border border-border" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      disabled
                      value={row.price}
                      className="w-20 px-2 py-1 bg-input border border-border rounded text-sm text-right text-foreground opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      disabled
                      value={row.compared}
                      className="w-20 px-2 py-1 bg-input border border-border rounded text-sm text-right text-foreground opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      disabled
                      value={row.cost}
                      className="w-20 px-2 py-1 bg-input border border-border rounded text-sm text-right text-foreground opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      disabled
                      value={row.fulfillment}
                      className="w-20 px-2 py-1 bg-input border border-border rounded text-sm text-right text-foreground opacity-60"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      disabled
                      value={row.sku}
                      className="w-28 px-2 py-1 bg-input border border-border rounded text-sm text-foreground opacity-60"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
