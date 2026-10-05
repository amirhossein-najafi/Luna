import { useEffect, useState, type ChangeEvent } from 'react'
import { Button, Notice, PageHeader, fieldClass } from '../components/ui.tsx'
import { categories, categoryInUse, nextCategoryTone } from '../data/categories.ts'
import { parseTransactionCsv, type CsvDraft } from '../domain/csv.ts'
import { parseBackup, serializeBackup } from '../lib/backup.ts'
import { todayJalali } from '../lib/jalali.ts'
import { formatNumber } from '../lib/money.ts'
import { useFinance } from '../store/finance.tsx'
import type { FlowType } from '../types.ts'

export function SettingsPage() {
  const { state, setApiKey, replaceAll, reset, saveCategory, deleteCategory, importTransactions } = useFinance()
  const [draft, setDraft] = useState(state.apiKey)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryType, setCategoryType] = useState<FlowType>('expense')
  const [categoryError, setCategoryError] = useState('')
  const [csv, setCsv] = useState<{ accepted: CsvDraft[]; skipped: string[] } | null>(null)

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
      const next = parseBackup(await file.text())
      replaceAll({ ...next, apiKey: state.apiKey })
      setMessage({ tone: 'ok', text: 'داده‌ها وارد شد و جای اطلاعات قبلی را گرفت.' })
    } catch {
      setMessage({ tone: 'err', text: 'این فایل برای Luna قابل خواندن نیست.' })
    }
  }

  function addCategory() {
    const name = categoryName.trim()
    if (!name) {
      setCategoryError('نام دسته لازم است.')
      return
    }
    const taken =
      categories.some((category) => category.type === categoryType && category.name === name) ||
      state.categories.some((category) => category.type === categoryType && category.name === name)
    if (taken) {
      setCategoryError('این نام برای همین نوع وجود دارد.')
      return
    }
    saveCategory({ id: '', name, type: categoryType, tone: nextCategoryTone(state.categories.length) })
    setCategoryName('')
    setCategoryError('')
    setMessage({ tone: 'ok', text: 'دسته اضافه شد و در فرم تراکنش دیده می‌شود.' })
  }

  function downloadSample() {
    const sample = '\uFEFFتاریخ,مبلغ,نوع,دسته,حساب,توضیح\n1405-07-01,120000,هزینه,خوراک,کیف پول,ناهار\n'
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'luna-sample.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function onCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const parsed = parseTransactionCsv(await file.text(), { accounts: state.accounts, categories: state.categories })
    setCsv(parsed)
    setMessage(null)
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
        <h2 className="font-bold">دسته‌های خودت</h2>
        <p className="mt-2 text-sm text-mute">دسته‌های ثابت Luna می‌مانند. دستهٔ تازه در تراکنش، بودجه و پرداخت تکراری می‌آید.</p>
        <ul className="mt-4 flex flex-col gap-2">
          {state.categories.length === 0 ? <li className="text-sm text-mute">هنوز دستهٔ سفارشی نیست.</li> : null}
          {state.categories.map((category) => {
            const used = categoryInUse(category.id, state)
            return (
              <li key={category.id} className="flex items-center justify-between gap-3 rounded-2xl bg-raise px-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: category.tone }} />
                  {category.name}
                  <span className="text-xs text-mute">{category.type === 'income' ? 'درآمد' : 'هزینه'}</span>
                </span>
                <button
                  type="button"
                  className="text-xs text-mute hover:text-out disabled:opacity-40"
                  disabled={used}
                  onClick={() => deleteCategory(category.id)}
                >
                  {used ? 'در حال استفاده' : 'حذف'}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <input
            className={fieldClass}
            aria-label="نام دسته"
            maxLength={24}
            value={categoryName}
            placeholder="مثلاً قهوه"
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <select className={fieldClass} aria-label="نوع دسته" value={categoryType} onChange={(event) => setCategoryType(event.target.value as FlowType)}>
            <option value="expense">هزینه</option>
            <option value="income">درآمد</option>
          </select>
          <Button onClick={addCategory}>افزودن</Button>
        </div>
        {categoryError ? <p className="mt-2 text-sm text-out">{categoryError}</p> : null}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="font-bold">ورود CSV</h2>
        <p className="mt-2 text-sm text-mute">
          سطر اول می‌تواند این ستون‌ها را داشته باشد: تاریخ، مبلغ، نوع، دسته، حساب، توضیح. نوع را هزینه، درآمد یا انتقال بنویس. ورود، تراکنش‌های فعلی را پاک نمی‌کند.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-gold px-4 py-2.5 text-sm font-medium text-on-gold">
            انتخاب فایل
            <input className="sr-only" type="file" accept=".csv,text/csv" onChange={onCsv} />
          </label>
          <Button tone="ghost" onClick={downloadSample}>
            نمونه CSV
          </Button>
        </div>
        {csv ? (
          <div className="mt-4">
            <p className="text-sm">{formatNumber(csv.accepted.length)} ردیف آماده ورود است.</p>
            {csv.skipped.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 text-xs text-mute">
                {csv.skipped.slice(0, 5).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Button
                disabled={csv.accepted.length === 0}
                onClick={() => {
                  importTransactions(csv.accepted)
                  setMessage({ tone: 'ok', text: `${formatNumber(csv.accepted.length)} تراکنش به لیست اضافه شد.` })
                  setCsv(null)
                }}
              >
                افزودن تراکنش‌ها
              </Button>
              <Button tone="ghost" onClick={() => setCsv(null)}>
                انصراف
              </Button>
            </div>
          </div>
        ) : null}
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
