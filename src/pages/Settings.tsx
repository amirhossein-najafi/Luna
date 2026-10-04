import { useEffect, useState, type ChangeEvent } from 'react'
import { Button, Notice, PageHeader, fieldClass } from '../components/ui.tsx'
import { parseBackup, serializeBackup } from '../lib/backup.ts'
import { todayJalali } from '../lib/jalali.ts'
import { useFinance } from '../store/finance.tsx'

export function SettingsPage() {
  const { state, setApiKey, replaceAll, reset } = useFinance()
  const [draft, setDraft] = useState(state.apiKey)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setDraft(state.apiKey)
  }, [state.apiKey])

  function saveKey() {
    setApiKey(draft.trim())
    setMessage({ tone: 'ok', text: 'کلید فقط روی همین مرورگر ذخیره شد.' })
  }

  function download() {
    const blob = new Blob([serializeBackup(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `luna-${todayJalali()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage({ tone: 'ok', text: 'فایل پشتیبان دانلود شد.' })
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      replaceAll(parseBackup(await file.text()))
      setMessage({ tone: 'ok', text: 'داده‌ها وارد شد و جای اطلاعات قبلی را گرفت.' })
    } catch {
      setMessage({ tone: 'err', text: 'این فایل برای Luna قابل خواندن نیست.' })
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader eyebrow="داده و قیمت" title="تنظیمات" />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-bold">کلید قیمت بازار</h2>
        <p className="mt-2 text-sm text-mute">
          قیمت طلا، دلار و سکه را می‌توانی در صفحه دارایی دستی بنویسی. اگر کلید رایگان BrsApi داشته باشی، همان‌جا دکمه دریافت قیمت کار می‌کند.
        </p>
        <a
          className="mt-2 inline-block text-sm text-gold"
          href="https://brsapi.ir/free-api-gold-currency-webservice/"
          target="_blank"
          rel="noreferrer"
        >
          دریافت کلید رایگان
        </a>
        <label className="mt-4 flex flex-col gap-1.5 text-sm">
          کلید API
          <input
            className={fieldClass}
            type="password"
            autoComplete="off"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <Button className="mt-3" onClick={saveKey}>
          ذخیره کلید
        </Button>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-bold">پشتیبان</h2>
        <p className="mt-2 text-sm text-mute">خروجی JSON را نگه دار تا با عوض کردن مرورگر، دخل‌وخرجت از بین نرود.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={download}>خروجی JSON</Button>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm font-medium hover:bg-raise">
            ورودی JSON
            <input className="sr-only" type="file" accept="application/json,.json" onChange={onImport} />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-out/40 bg-panel p-5">
        <h2 className="font-bold">پاک کردن داده‌ها</h2>
        <p className="mt-2 text-sm text-mute">تراکنش‌ها، بودجه‌ها، دارایی و کلید قیمت حذف می‌شوند. ظاهر روشن یا تیره می‌ماند.</p>
        {confirming ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              tone="danger"
              onClick={() => {
                reset()
                setConfirming(false)
                setMessage({ tone: 'ok', text: 'همه داده‌های Luna پاک شد.' })
              }}
            >
              بله، پاک شود
            </Button>
            <Button tone="ghost" onClick={() => setConfirming(false)}>
              انصراف
            </Button>
          </div>
        ) : (
          <Button className="mt-4" tone="danger" onClick={() => setConfirming(true)}>
            پاک کردن همه
          </Button>
        )}
      </section>
    </div>
  )
}
