import { config } from '../config.js'
import { dateKeyOf, daysBetween, isLeapYear } from './dates.js'
import { lunarAnniversary, solarToLunar } from './lunar.js'
import { parseIsoDate } from './people.js'

/**
 * Event = {
 *   id, type: 'birthday' | 'anniversary', person, date: Date,
 *   age?: number|null   (sinh nhật: tròn bao nhiêu tuổi; null nếu không rõ năm sinh)
 *   years?: number      (kỷ niệm cưới: bao nhiêu năm)
 *   lunar?: { day, month } (sinh nhật tính theo âm lịch)
 *   moved?: boolean     (sinh 29/2, năm không nhuận dời sang 28/2)
 * }
 */

function solarOccurrence(parsed, year) {
  if (parsed.m === 2 && parsed.d === 29 && !isLeapYear(year)) {
    return { date: new Date(year, 1, 28), moved: true }
  }
  return { date: new Date(year, parsed.m - 1, parsed.d), moved: false }
}

function birthdayEvents(person, year) {
  const parsed = parseIsoDate(person.birthday)
  if (!parsed) return []

  if (person.lunar && parsed.y) {
    const birthLunar = solarToLunar(parsed.d, parsed.m, parsed.y)
    const out = []
    // Sinh nhật âm của năm âm (year - 1) có thể rơi vào tháng 1–2 dương của `year`.
    for (const lunarYear of [year - 1, year]) {
      const age = lunarYear - birthLunar.year
      if (age < 0) continue
      const solar = lunarAnniversary(birthLunar.day, birthLunar.month, lunarYear)
      if (!solar || solar.year !== year) continue
      out.push({
        id: `b-${person.id}-${lunarYear}`,
        type: 'birthday',
        person,
        date: new Date(solar.year, solar.month - 1, solar.day),
        age,
        lunar: { day: birthLunar.day, month: birthLunar.month },
      })
    }
    return out
  }

  const age = parsed.y ? year - parsed.y : null
  if (age != null && age < 0) return []
  const { date, moved } = solarOccurrence(parsed, year)
  return [{ id: `b-${person.id}-${year}`, type: 'birthday', person, date, age, moved }]
}

function anniversaryEvents(person, year) {
  if (!config.showAnniversaries) return []
  const parsed = parseIsoDate(person.marriedAt)
  if (!parsed?.y) return []
  const years = year - parsed.y
  if (years < 0) return []
  const { date, moved } = solarOccurrence(parsed, year)
  return [{ id: `a-${person.id}-${year}`, type: 'anniversary', person, date, years, moved }]
}

function compareEvents(a, b) {
  return a.date - b.date
    || (a.type === b.type ? 0 : a.type === 'birthday' ? -1 : 1)
    || a.person.name.localeCompare(b.person.name, 'vi')
}

/** Sự kiện của một người trong năm dương `year` */
export function personEventsInYear(person, year) {
  return [...birthdayEvents(person, year), ...anniversaryEvents(person, year)].sort(compareEvents)
}

const cache = new WeakMap()

/** Tất cả sự kiện trong năm dương `year`: { list, byDay: Map<"M-D", Event[]>, byMonth: Event[][] } */
export function eventsForYear(people, year) {
  let perPeople = cache.get(people)
  if (!perPeople) {
    perPeople = new Map()
    cache.set(people, perPeople)
  }
  if (perPeople.has(year)) return perPeople.get(year)

  const list = people
    .flatMap((person) => [...birthdayEvents(person, year), ...anniversaryEvents(person, year)])
    .sort(compareEvents)

  const byDay = new Map()
  const byMonth = Array.from({ length: 12 }, () => [])
  for (const event of list) {
    const key = dateKeyOf(event.date)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(event)
    byMonth[event.date.getMonth()].push(event)
  }

  const result = { list, byDay, byMonth }
  perPeople.set(year, result)
  return result
}

/** Các sự kiện từ hôm nay trở đi (tối đa `take`), kèm số ngày còn lại. */
export function upcomingEvents(people, today, take = 8) {
  const year = today.getFullYear()
  return [...eventsForYear(people, year).list, ...eventsForYear(people, year + 1).list]
    .map((event) => ({ ...event, daysLeft: daysBetween(today, event.date) }))
    .filter((event) => event.daysLeft >= 0 && event.daysLeft <= 366)
    .slice(0, take)
}

export function eventTitle(event) {
  if (event.type === 'anniversary') {
    return event.years === 0 ? 'Ngày cưới' : `Kỷ niệm ${event.years} năm ngày cưới`
  }
  if (event.age == null) return 'Sinh nhật'
  if (event.age === 0) return 'Ngày chào đời'
  return `Sinh nhật · tròn ${event.age} tuổi`
}
