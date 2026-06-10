from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
import math
from typing import List, Optional

app = FastAPI(title="KrishiDam AI Service", version="1.0.0")

class PriceFloorInput(BaseModel):
    crop_type: str
    variety: str
    quality_grade: str
    moisture_pct: float
    chita_pct: float
    quantity_kg: int
    district: str
    harvest_date: str

class PriceFloorOutput(BaseModel):
    floor_price_per_kg: float
    govt_reference: float
    market_median_30d: float
    demand_index: str
    seasonal_factor: str
    quality_deductions: float
    velocity_score: float
    explanation_bn: str
    explanation_en: str
    confidence: str
    cached: bool
    valid_until: str

class DemandForecastInput(BaseModel):
    crop_type: str
    variety: str
    district: str
    quantity_kg: int

class DemandForecastOutput(BaseModel):
    demand_level: str
    active_buyers: int
    competing_listings: int
    recommended_action: str
    reasoning_bn: str
    reasoning_en: str
    expected_response_hours: int

class MatchMillsInput(BaseModel):
    crop_type: str
    variety: str
    district: str
    moisture_pct: float
    quantity_kg: int

class MillMatch(BaseModel):
    mill_id: str
    match_score: int
    reason_bn: str
    reason_en: str

# 1. Price Floor Calculation Endpoint
@app.post("/price-floor", response_model=PriceFloorOutput)
def calculate_price_floor(data: PriceFloorInput):
    # Rule 1: Govt reference price base (simulated database lookup)
    govt_reference = 32.50 # default
    if "28" in data.variety:
        govt_reference = 30.00
    elif "29" in data.variety:
        govt_reference = 31.00
    elif "Miniket" in data.variety:
        govt_reference = 38.00

    # Rule 2: 30-day market median (simulated transaction data)
    market_median_30d = govt_reference * 0.95

    # Rule 3: Velocity score (simulated last 7 days activity)
    velocity_score = 0.75

    # Rule 4: Demand pressure (simulated mill preferences count)
    demand_pressure = 0.80

    # Rule 5: Seasonal coefficient
    # Boro Peak: Apr - Jun (0.95)
    # Off-season: Oct - Jan (1.05)
    # Others: 1.0
    seasonal_coeff = 1.00
    try:
        harvest_dt = datetime.strptime(data.harvest_date, "%Y-%m-%d")
        if harvest_dt.month in [4, 5, 6]:
            seasonal_coeff = 0.95
            seasonal_factor = "peak_harvest"
        elif harvest_dt.month in [10, 11, 12, 1]:
            seasonal_coeff = 1.05
            seasonal_factor = "off_season"
        else:
            seasonal_factor = "mid_season"
    except Exception:
        seasonal_factor = "peak_harvest"
        seasonal_coeff = 0.95

    # Rule 6: Quality deductions
    # Moisture > 14% = -0.5% per point above
    # Chita > 3% = -1% per point above
    moisture_deduction = 0.0
    if data.moisture_pct > 14.0:
        moisture_deduction = (data.moisture_pct - 14.0) * 0.005 * govt_reference

    chita_deduction = 0.0
    if data.chita_pct > 3.0:
        chita_deduction = (data.chita_pct - 3.0) * 0.01 * govt_reference

    quality_deductions = round(moisture_deduction + chita_deduction, 2)

    # Rule 7: Composite floor = (govt_price × 0.90 × seasonal_coeff) adjusted by demand pressure and quality
    composite_floor = (govt_reference * 0.90 * seasonal_coeff) + (demand_pressure * 0.5) - quality_deductions

    # Rule 8: Final floor = max(composite_floor, market_median × 0.85)
    final_floor = max(composite_floor, market_median_30d * 0.85)
    final_floor = round(final_floor, 2)

    # Cache metadata
    valid_until = (datetime.utcnow() + timedelta(hours=6)).isoformat() + "Z"

    explanation_bn = f"আপনার ধানের ন্যূনতম মূল্য ৳{final_floor}/কেজি (৳{round(final_floor * 40)}/মন)। সরকারি মূল্য ({round(govt_reference * 40)}/মন) এবং মৌসুমি চাহিদা দ্বারা বিশ্লেষিত।"
    explanation_en = f"Floor price is set at ৳{final_floor}/kg (৳{round(final_floor * 40)}/maund) based on government reference rate ({round(govt_reference * 40)}/maund) and seasonal demands."

    return PriceFloorOutput(
        floor_price_per_kg=final_floor,
        govt_reference=govt_reference,
        market_median_30d=market_median_30d,
        demand_index="high" if demand_pressure > 0.7 else "medium",
        seasonal_factor=seasonal_factor,
        quality_deductions=quality_deductions,
        velocity_score=velocity_score,
        explanation_bn=explanation_bn,
        explanation_en=explanation_en,
        confidence="high",
        cached=False,
        valid_until=valid_until
    )

# 2. Demand Forecasting Endpoint
@app.post("/demand-forecast", response_model=DemandForecastOutput)
def demand_forecast(data: DemandForecastInput):
    # Simulate demand calculation
    active_buyers = 5
    if "boro" in data.crop_type.lower():
        active_buyers = 7
    
    competing_listings = 3
    demand_level = "high" if active_buyers > competing_listings else "moderate"
    recommended_action = "post_now" if demand_level == "high" else "wait_for_trend"

    reasoning_bn = f"আপনার জেলায় বর্তমানে {active_buyers}টি চালকল সক্রিয়ভাবে ধান খুঁজছে। এখনই পোস্ট করা সুবিধাজনক।"
    reasoning_en = f"There are {active_buyers} mills actively looking for crops in your district. It is recommended to post now."

    return DemandForecastOutput(
        demand_level=demand_level,
        active_buyers=active_buyers,
        competing_listings=competing_listings,
        recommended_action=recommended_action,
        reasoning_bn=reasoning_bn,
        reasoning_en=reasoning_en,
        expected_response_hours=8 if demand_level == "high" else 24
    )

# 3. Match Mills Endpoint
@app.post("/match-mills", response_model=List[MillMatch])
def match_mills(data: MatchMillsInput):
    # Return simulated mill ranking matches
    return [
        MillMatch(
            mill_id="00000000-0000-0000-0000-000000000010",
            match_score=94,
            reason_bn="আপনার জেলা Cumilla-এর একদম কাছাকাছি নারায়ণগঞ্জের রাইস মিল এবং আর্দ্রতা পছন্দ মিলেছে।",
            reason_en="Located in Narayanganj near Cumilla, perfectly matching moisture preferences."
        ),
        MillMatch(
            mill_id="00000000-0000-0000-0000-000000000011",
            match_score=87,
            reason_bn="গাজীপুরের চালকল যা আপনার তালিকাভুক্ত ধানের জাত BR-28 পছন্দ করে।",
            reason_en="Gazipur mill actively matching preferences for your BR-28 variety."
        )
    ]
