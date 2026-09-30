import styles from './storefront.module.css'

type Props = {
  title: string
  body: string
  actionLabel: string
  onAction: () => void
}

export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  return (
    <section className={styles.empty}>
      <h2>{title}</h2>
      <p>{body}</p>
      <button className={styles.primaryBtn} type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </section>
  )
}
