// PDF reading function — extracts structured itinerary data from a travel PDF

class ItineraryDay {
  day_number int
  date string
  title string
  theme string?
  activities ActivityEntry[]
}

class ActivityEntry {
  start_time string?
  end_time string?
  title string
  description string
  activity_type string @description("One of: MEAL, VISIT, TRANSPORT, WALK, NIGHTLIFE, SHOW, SHOPPING, REST")
  place_name string?
  address string?
  neighborhood string?
  price_min_cents int? @description("Minimum price per person in euro cents")
  price_max_cents int? @description("Maximum price per person in euro cents")
  price_note string?
  highlights string[] @description("Notable items: dishes to order, artworks to see, etc.")
  is_alternative bool @description("True if this is an alternative suggestion, not the main recommendation")
  alternative_to string? @description("Title of the main activity this is an alternative to")
}

class BookingInfo {
  attraction_name string
  price_cents int?
  discount_note string?
  booking_url string?
}

class TravelTipInfo {
  category string @description("One of: TRANSPORT, SAFETY, BUDGET, PACKING")
  content string
}

class ParsedItinerary {
  title string
  city string
  start_date string @description("ISO date: YYYY-MM-DD")
  end_date string @description("ISO date: YYYY-MM-DD")
  days ItineraryDay[]
  bookings BookingInfo[]
  tips TravelTipInfo[]
}

function ExtractItinerary(itinerary_text: string) -> ParsedItinerary {
  client GPT52
  prompt #"
    You are a travel itinerary parser. Extract ALL structured data from this travel itinerary text.

    Rules:
    - Extract every single activity mentioned, including alternatives
    - Prices should be converted to euro cents (e.g. €15 = 1500, €2.50 = 250)
    - For price ranges like "€15–22/persona", set price_min_cents=1500 and price_max_cents=2200
    - Mark alternative suggestions with is_alternative=true
    - Classify each activity_type accurately
    - Extract all advance bookings with their URLs
    - Extract practical tips (transport cards, safety warnings, etc.)
    - Use ISO date format for all dates

    Itinerary:
    {{ itinerary_text }}

    {{ ctx.output_format }}
  "#
}

test PlanItPdf {
  functions [ExtractItinerary]
  args {
    itinerary_text "Test itinerary text"
  }
}
