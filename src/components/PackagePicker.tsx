'use client'

import { useState } from 'react'

interface PackageOption {
  name: string
  price: number
  desc: string
  tag?: string
}

interface AddonOption {
  name: string
  price: number
  free?: boolean
}

const PACKAGES: PackageOption[] = [
  { name: 'Photobooth Only', price: 3500, desc: '3 hrs · Unlimited shots · Custom backdrop + template' },
  { name: 'Photography Only', price: 4500, desc: '3 hrs · 80–100 sneak peeks · 300+ edited photos' },
  { name: 'Photobooth + Photography', price: 6500, desc: '3 hrs · Unlimited shots + 300+ edited photos', tag: 'Popular' },
  { name: 'Premium Bundle', price: 8000, desc: '4 hrs · Photography + Videography · 400+ photos · Pre-event shoot', tag: 'Best Value' },
]

const ADDONS: AddonOption[] = [
  { name: 'Extended coverage (+1 hr)', price: 800 },
  { name: 'Magnet prints (150 pcs)', price: 1500 },
  { name: 'Custom template design', price: 0, free: true },
  { name: '30-sec highlight video', price: 0, free: true },
]

interface PickerValue {
  packageName: string
  packagePrice: number
}

interface Props {
  value: PickerValue
  onChange: (v: PickerValue) => void
  onDepositSuggest?: (deposit: number) => void
}

export default function PackagePicker({ value, onChange, onDepositSuggest }: Props) {
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])

  const base = PACKAGES.find(p => p.name === value.packageName)

  function addonTotal(addons: string[]) {
    return addons.reduce((sum, name) => sum + (ADDONS.find(a => a.name === name)?.price ?? 0), 0)
  }

  function fullName(baseName: string, addons: string[]) {
    const paid = addons.filter(a => !ADDONS.find(x => x.name === a)?.free)
    return paid.length > 0 ? `${baseName} + ${paid.join(' + ')}` : baseName
  }

  function selectPackage(pkg: PackageOption) {
    const total = pkg.price + addonTotal(selectedAddons)
    onChange({ packageName: fullName(pkg.name, selectedAddons), packagePrice: total })
    onDepositSuggest?.(Math.max(1000, Math.round(total * 0.15)))
  }

  function toggleAddon(name: string) {
    const next = selectedAddons.includes(name)
      ? selectedAddons.filter(a => a !== name)
      : [...selectedAddons, name]
    setSelectedAddons(next)
    if (base) {
      const basePkg = PACKAGES.find(p => base.name.startsWith(p.name)) ?? base
      const total = basePkg.price + addonTotal(next)
      onChange({ packageName: fullName(basePkg.name, next), packagePrice: total })
      onDepositSuggest?.(Math.max(1000, Math.round(total * 0.15)))
    }
  }

  const total = (base?.price ?? 0) + addonTotal(selectedAddons)

  return (
    <div className="space-y-3 col-span-2">
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Package</p>

      {/* Package cards — 2 col grid */}
      <div className="grid grid-cols-2 gap-2">
        {PACKAGES.map(pkg => {
          const selected = value.packageName === pkg.name
          return (
            <button
              key={pkg.name}
              type="button"
              onClick={() => selectPackage(pkg)}
              className="relative text-left p-3 rounded-xl border-2 transition-all"
              style={{
                borderColor: selected ? '#10b981' : 'var(--card-border)',
                background: selected ? 'rgba(16,185,129,0.08)' : 'var(--subtle-bg)',
              }}
            >
              {pkg.tag && (
                <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 10 }}>
                  {pkg.tag}
                </span>
              )}
              <p className="text-xs font-semibold pr-10" style={{ color: selected ? '#10b981' : 'var(--text-heading)' }}>
                {pkg.name}
              </p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-faint)', fontSize: 10 }}>
                {pkg.desc}
              </p>
              <p className="text-sm font-bold mt-1.5" style={{ color: selected ? '#10b981' : 'var(--text-heading)' }}>
                ₱{pkg.price.toLocaleString()}
              </p>
            </button>
          )
        })}
      </div>

      {/* Add-ons — only shown after a package is selected */}
      {base && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Add-ons</p>
          {ADDONS.map(addon => {
            const checked = selectedAddons.includes(addon.name)
            return (
              <label key={addon.name} className="flex items-center gap-2.5 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAddon(addon.name)}
                  className="rounded accent-indigo-500"
                />
                <span className="text-xs flex-1" style={{ color: 'var(--text-heading)' }}>{addon.name}</span>
                <span className="text-xs font-semibold" style={{ color: addon.free ? '#10b981' : 'var(--text-muted)' }}>
                  {addon.free ? 'FREE' : `+₱${addon.price.toLocaleString()}`}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {/* Running total */}
      {base && (
        <div className="flex items-center justify-between rounded-xl px-4 py-2.5"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <div>
            <p className="text-xs" style={{ color: '#10b981' }}>{base.name}{selectedAddons.filter(a => !ADDONS.find(x => x.name === a)?.free).length > 0 ? ' + add-ons' : ''}</p>
            {selectedAddons.filter(a => !ADDONS.find(x => x.name === a)?.free).map(a => (
              <p key={a} className="text-xs" style={{ color: '#6b7280' }}>+ {a}</p>
            ))}
          </div>
          <p className="text-lg font-bold" style={{ color: '#10b981' }}>₱{total.toLocaleString()}</p>
        </div>
      )}
    </div>
  )
}
