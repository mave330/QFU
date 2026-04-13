from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import httpx
import math


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================
# AIRPORT DATABASE WITH RUNWAY INFORMATION
# ============================================

AIRPORT_DATABASE = {
    # Paris Charles de Gaulle
    "LFPG": {
        "name": "Paris Charles de Gaulle",
        "city": "Paris",
        "country": "France",
        "lat": 49.0097,
        "lon": 2.5479,
        "elevation_ft": 392,
        "runways": [
            {"name": "08L/26R", "heading_08": 85, "heading_26": 265, "lat": 49.0180, "lon": 2.5200},
            {"name": "08R/26L", "heading_08": 85, "heading_26": 265, "lat": 49.0130, "lon": 2.5400},
            {"name": "09L/27R", "heading_09": 92, "heading_27": 272, "lat": 49.0050, "lon": 2.5300},
            {"name": "09R/27L", "heading_09": 92, "heading_27": 272, "lat": 49.0000, "lon": 2.5600},
        ]
    },
    # London Heathrow
    "EGLL": {
        "name": "London Heathrow",
        "city": "London",
        "country": "United Kingdom",
        "lat": 51.4700,
        "lon": -0.4543,
        "elevation_ft": 83,
        "runways": [
            {"name": "09L/27R", "heading_09": 92, "heading_27": 272, "lat": 51.4775, "lon": -0.4850},
            {"name": "09R/27L", "heading_09": 92, "heading_27": 272, "lat": 51.4650, "lon": -0.4350},
        ]
    },
    # New York JFK
    "KJFK": {
        "name": "John F. Kennedy International",
        "city": "New York",
        "country": "United States",
        "lat": 40.6413,
        "lon": -73.7781,
        "elevation_ft": 13,
        "runways": [
            {"name": "04L/22R", "heading_04": 43, "heading_22": 223, "lat": 40.6380, "lon": -73.7900},
            {"name": "04R/22L", "heading_04": 43, "heading_22": 223, "lat": 40.6450, "lon": -73.7700},
            {"name": "13L/31R", "heading_13": 134, "heading_31": 314, "lat": 40.6500, "lon": -73.7800},
            {"name": "13R/31L", "heading_13": 134, "heading_31": 314, "lat": 40.6350, "lon": -73.7650},
        ]
    },
    # Los Angeles
    "KLAX": {
        "name": "Los Angeles International",
        "city": "Los Angeles",
        "country": "United States",
        "lat": 33.9425,
        "lon": -118.4081,
        "elevation_ft": 128,
        "runways": [
            {"name": "06L/24R", "heading_06": 69, "heading_24": 249, "lat": 33.9500, "lon": -118.4300},
            {"name": "06R/24L", "heading_06": 69, "heading_24": 249, "lat": 33.9470, "lon": -118.4200},
            {"name": "07L/25R", "heading_07": 79, "heading_25": 259, "lat": 33.9350, "lon": -118.4000},
            {"name": "07R/25L", "heading_07": 79, "heading_25": 259, "lat": 33.9320, "lon": -118.3900},
        ]
    },
    # Frankfurt
    "EDDF": {
        "name": "Frankfurt am Main",
        "city": "Frankfurt",
        "country": "Germany",
        "lat": 50.0379,
        "lon": 8.5622,
        "elevation_ft": 364,
        "runways": [
            {"name": "07L/25R", "heading_07": 72, "heading_25": 252, "lat": 50.0500, "lon": 8.5300},
            {"name": "07R/25L", "heading_07": 72, "heading_25": 252, "lat": 50.0250, "lon": 8.5700},
            {"name": "07C/25C", "heading_07": 72, "heading_25": 252, "lat": 50.0380, "lon": 8.5500},
            {"name": "18/36", "heading_18": 180, "heading_36": 360, "lat": 50.0300, "lon": 8.5400},
        ]
    },
    # Amsterdam Schiphol
    "EHAM": {
        "name": "Amsterdam Schiphol",
        "city": "Amsterdam",
        "country": "Netherlands",
        "lat": 52.3086,
        "lon": 4.7639,
        "elevation_ft": -11,
        "runways": [
            {"name": "06/24", "heading_06": 58, "heading_24": 238, "lat": 52.3200, "lon": 4.7400},
            {"name": "09/27", "heading_09": 87, "heading_27": 267, "lat": 52.3100, "lon": 4.7800},
            {"name": "18L/36R", "heading_18": 183, "heading_36": 3, "lat": 52.3300, "lon": 4.7500},
            {"name": "18R/36L", "heading_18": 183, "heading_36": 3, "lat": 52.2900, "lon": 4.7700},
            {"name": "18C/36C", "heading_18": 183, "heading_36": 3, "lat": 52.3100, "lon": 4.7600},
        ]
    },
    # Dubai
    "OMDB": {
        "name": "Dubai International",
        "city": "Dubai",
        "country": "United Arab Emirates",
        "lat": 25.2528,
        "lon": 55.3644,
        "elevation_ft": 62,
        "runways": [
            {"name": "12L/30R", "heading_12": 119, "heading_30": 299, "lat": 25.2600, "lon": 55.3500},
            {"name": "12R/30L", "heading_12": 119, "heading_30": 299, "lat": 25.2450, "lon": 55.3800},
        ]
    },
    # Singapore Changi
    "WSSS": {
        "name": "Singapore Changi",
        "city": "Singapore",
        "country": "Singapore",
        "lat": 1.3644,
        "lon": 103.9915,
        "elevation_ft": 22,
        "runways": [
            {"name": "02L/20R", "heading_02": 20, "heading_20": 200, "lat": 1.3550, "lon": 103.9850},
            {"name": "02C/20C", "heading_02": 20, "heading_20": 200, "lat": 1.3650, "lon": 103.9950},
            {"name": "02R/20L", "heading_02": 20, "heading_20": 200, "lat": 1.3750, "lon": 104.0050},
        ]
    },
    # Tokyo Narita
    "RJAA": {
        "name": "Narita International",
        "city": "Tokyo",
        "country": "Japan",
        "lat": 35.7720,
        "lon": 140.3929,
        "elevation_ft": 141,
        "runways": [
            {"name": "16L/34R", "heading_16": 160, "heading_34": 340, "lat": 35.7800, "lon": 140.3850},
            {"name": "16R/34L", "heading_16": 160, "heading_34": 340, "lat": 35.7650, "lon": 140.4000},
        ]
    },
    # Sydney
    "YSSY": {
        "name": "Sydney Kingsford Smith",
        "city": "Sydney",
        "country": "Australia",
        "lat": -33.9461,
        "lon": 151.1772,
        "elevation_ft": 21,
        "runways": [
            {"name": "07/25", "heading_07": 70, "heading_25": 250, "lat": -33.9450, "lon": 151.1700},
            {"name": "16L/34R", "heading_16": 165, "heading_34": 345, "lat": -33.9350, "lon": 151.1750},
            {"name": "16R/34L", "heading_16": 165, "heading_34": 345, "lat": -33.9550, "lon": 151.1800},
        ]
    },
    # Chicago O'Hare
    "KORD": {
        "name": "Chicago O'Hare International",
        "city": "Chicago",
        "country": "United States",
        "lat": 41.9742,
        "lon": -87.9073,
        "elevation_ft": 672,
        "runways": [
            {"name": "09L/27R", "heading_09": 90, "heading_27": 270, "lat": 41.9800, "lon": -87.9200},
            {"name": "09R/27L", "heading_09": 90, "heading_27": 270, "lat": 41.9700, "lon": -87.9000},
            {"name": "10L/28R", "heading_10": 100, "heading_28": 280, "lat": 41.9850, "lon": -87.8900},
            {"name": "10C/28C", "heading_10": 100, "heading_28": 280, "lat": 41.9750, "lon": -87.9100},
            {"name": "10R/28L", "heading_10": 100, "heading_28": 280, "lat": 41.9650, "lon": -87.9300},
        ]
    },
    # Madrid Barajas
    "LEMD": {
        "name": "Adolfo Suárez Madrid-Barajas",
        "city": "Madrid",
        "country": "Spain",
        "lat": 40.4983,
        "lon": -3.5676,
        "elevation_ft": 1998,
        "runways": [
            {"name": "14L/32R", "heading_14": 143, "heading_32": 323, "lat": 40.5100, "lon": -3.5800},
            {"name": "14R/32L", "heading_14": 143, "heading_32": 323, "lat": 40.4900, "lon": -3.5600},
            {"name": "18L/36R", "heading_18": 180, "heading_36": 360, "lat": 40.5000, "lon": -3.5500},
            {"name": "18R/36L", "heading_18": 180, "heading_36": 360, "lat": 40.4850, "lon": -3.5900},
        ]
    },
    # Beijing Capital
    "ZBAA": {
        "name": "Beijing Capital International",
        "city": "Beijing",
        "country": "China",
        "lat": 40.0799,
        "lon": 116.6031,
        "elevation_ft": 116,
        "runways": [
            {"name": "01/19", "heading_01": 10, "heading_19": 190, "lat": 40.0800, "lon": 116.5900},
            {"name": "18L/36R", "heading_18": 180, "heading_36": 360, "lat": 40.0850, "lon": 116.6100},
            {"name": "18R/36L", "heading_18": 180, "heading_36": 360, "lat": 40.0750, "lon": 116.6200},
        ]
    },
    # Hong Kong
    "VHHH": {
        "name": "Hong Kong International",
        "city": "Hong Kong",
        "country": "Hong Kong",
        "lat": 22.3080,
        "lon": 113.9185,
        "elevation_ft": 28,
        "runways": [
            {"name": "07L/25R", "heading_07": 72, "heading_25": 252, "lat": 22.3150, "lon": 113.9000},
            {"name": "07R/25L", "heading_07": 72, "heading_25": 252, "lat": 22.3000, "lon": 113.9350},
        ]
    },
    # Atlanta
    "KATL": {
        "name": "Hartsfield-Jackson Atlanta International",
        "city": "Atlanta",
        "country": "United States",
        "lat": 33.6407,
        "lon": -84.4277,
        "elevation_ft": 1026,
        "runways": [
            {"name": "08L/26R", "heading_08": 89, "heading_26": 269, "lat": 33.6500, "lon": -84.4400},
            {"name": "08R/26L", "heading_08": 89, "heading_26": 269, "lat": 33.6450, "lon": -84.4300},
            {"name": "09L/27R", "heading_09": 89, "heading_27": 269, "lat": 33.6350, "lon": -84.4200},
            {"name": "09R/27L", "heading_09": 89, "heading_27": 269, "lat": 33.6300, "lon": -84.4100},
            {"name": "10/28", "heading_10": 96, "heading_28": 276, "lat": 33.6250, "lon": -84.4000},
        ]
    },
    # Paris Orly
    "LFPO": {
        "name": "Paris Orly",
        "city": "Paris",
        "country": "France",
        "lat": 48.7262,
        "lon": 2.3652,
        "elevation_ft": 291,
        "runways": [
            {"name": "06/24", "heading_06": 60, "heading_24": 240, "lat": 48.7300, "lon": 2.3500},
            {"name": "07/25", "heading_07": 73, "heading_25": 253, "lat": 48.7230, "lon": 2.3750},
            {"name": "02/20", "heading_02": 20, "heading_20": 200, "lat": 48.7280, "lon": 2.3600},
        ]
    },
    # Munich
    "EDDM": {
        "name": "Munich International",
        "city": "Munich",
        "country": "Germany",
        "lat": 48.3538,
        "lon": 11.7861,
        "elevation_ft": 1487,
        "runways": [
            {"name": "08L/26R", "heading_08": 80, "heading_26": 260, "lat": 48.3600, "lon": 11.7600},
            {"name": "08R/26L", "heading_08": 80, "heading_26": 260, "lat": 48.3480, "lon": 11.8100},
        ]
    },
    # Toronto Pearson
    "CYYZ": {
        "name": "Toronto Pearson International",
        "city": "Toronto",
        "country": "Canada",
        "lat": 43.6777,
        "lon": -79.6248,
        "elevation_ft": 569,
        "runways": [
            {"name": "05/23", "heading_05": 55, "heading_23": 235, "lat": 43.6850, "lon": -79.6400},
            {"name": "06L/24R", "heading_06": 62, "heading_24": 242, "lat": 43.6750, "lon": -79.6200},
            {"name": "06R/24L", "heading_06": 62, "heading_24": 242, "lat": 43.6650, "lon": -79.6100},
            {"name": "15L/33R", "heading_15": 152, "heading_33": 332, "lat": 43.6800, "lon": -79.6300},
            {"name": "15R/33L", "heading_15": 152, "heading_33": 332, "lat": 43.6700, "lon": -79.6150},
        ]
    },
    # Istanbul
    "LTFM": {
        "name": "Istanbul Airport",
        "city": "Istanbul",
        "country": "Turkey",
        "lat": 41.2753,
        "lon": 28.7519,
        "elevation_ft": 325,
        "runways": [
            {"name": "16L/34R", "heading_16": 163, "heading_34": 343, "lat": 41.2900, "lon": 28.7400},
            {"name": "16R/34L", "heading_16": 163, "heading_34": 343, "lat": 41.2800, "lon": 28.7600},
            {"name": "17L/35R", "heading_17": 173, "heading_35": 353, "lat": 41.2700, "lon": 28.7700},
            {"name": "17R/35L", "heading_17": 173, "heading_35": 353, "lat": 41.2600, "lon": 28.7500},
        ]
    },
    # Nice Côte d'Azur
    "LFMN": {
        "name": "Nice Côte d'Azur",
        "city": "Nice",
        "country": "France",
        "lat": 43.6584,
        "lon": 7.2159,
        "elevation_ft": 12,
        "runways": [
            {"name": "04L/22R", "heading_04": 40, "heading_22": 220, "lat": 43.6600, "lon": 7.2000},
            {"name": "04R/22L", "heading_04": 40, "heading_22": 220, "lat": 43.6550, "lon": 7.2300},
        ]
    },
}

# ============================================
# PYDANTIC MODELS
# ============================================

class Aircraft(BaseModel):
    icao24: str
    callsign: Optional[str] = None
    latitude: float
    longitude: float
    altitude_ft: float
    velocity_knots: Optional[float] = None
    heading: Optional[float] = None
    vertical_rate: Optional[float] = None
    on_ground: bool = False
    distance_km: Optional[float] = None

class RunwayStatus(BaseModel):
    runway_name: str
    direction: str  # e.g., "27R" or "09L"
    heading: int
    aircraft_count: int
    aircraft: List[Aircraft] = []

class AirportInfo(BaseModel):
    icao: str
    name: str
    city: str
    country: str
    lat: float
    lon: float
    elevation_ft: int

class RunwayAnalysisResponse(BaseModel):
    airport: AirportInfo
    timestamp: datetime
    active_runways: List[RunwayStatus]
    total_landing_aircraft: int
    all_aircraft_nearby: List[Aircraft]
    message: str

# ============================================
# UTILITY FUNCTIONS
# ============================================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers"""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def normalize_heading(heading: float) -> float:
    """Normalize heading to 0-360 range"""
    while heading < 0:
        heading += 360
    while heading >= 360:
        heading -= 360
    return heading

def heading_difference(h1: float, h2: float) -> float:
    """Calculate smallest difference between two headings"""
    diff = abs(normalize_heading(h1) - normalize_heading(h2))
    return min(diff, 360 - diff)

def get_runway_direction_from_heading(runway: dict, aircraft_heading: float) -> Optional[str]:
    """Determine which runway direction based on aircraft heading"""
    runway_name = runway["name"]
    parts = runway_name.split("/")
    
    if len(parts) != 2:
        return None
    
    dir1, dir2 = parts
    
    # Extract headings from runway dict
    heading_keys = [k for k in runway.keys() if k.startswith("heading_")]
    
    best_match = None
    best_diff = 180
    
    for key in heading_keys:
        rwy_heading = runway[key]
        diff = heading_difference(aircraft_heading, rwy_heading)
        
        if diff < best_diff:
            best_diff = diff
            # Match the direction based on heading key
            dir_num = key.replace("heading_", "")
            # Find matching direction
            for d in [dir1, dir2]:
                # Extract numeric part
                num_part = ''.join(filter(str.isdigit, d))
                if num_part and int(num_part) == int(dir_num):
                    best_match = d
                    break
                # Check if heading matches approximately
                if int(dir_num) * 10 == int(round(rwy_heading / 10) * 10) % 360 or \
                   abs(int(dir_num) * 10 - rwy_heading) < 15:
                    if dir_num in d.lower() or str(int(dir_num)) in d:
                        best_match = d
                        break
    
    # Fallback: match based on heading value
    if best_match is None:
        for key in heading_keys:
            rwy_heading = runway[key]
            diff = heading_difference(aircraft_heading, rwy_heading)
            if diff < 30:  # Within 30 degrees
                dir_num = key.replace("heading_", "")
                for d in [dir1, dir2]:
                    num_only = ''.join(filter(str.isdigit, d))
                    if num_only == dir_num or (num_only and abs(int(num_only) - int(dir_num)) <= 1):
                        best_match = d
                        break
                if best_match:
                    break
    
    return best_match if best_diff < 30 else None

async def fetch_aircraft_from_opensky(lat: float, lon: float, radius_km: float = 30) -> List[dict]:
    """Fetch aircraft from OpenSky Network API"""
    # Calculate bounding box
    lat_delta = radius_km / 111  # 1 degree ≈ 111 km
    lon_delta = radius_km / (111 * math.cos(math.radians(lat)))
    
    lamin = lat - lat_delta
    lamax = lat + lat_delta
    lomin = lon - lon_delta
    lomax = lon + lon_delta
    
    url = f"https://opensky-network.org/api/states/all?lamin={lamin}&lomin={lomin}&lamax={lamax}&lomax={lomax}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            if data.get("states") is None:
                return []
            
            aircraft_list = []
            for state in data["states"]:
                # OpenSky state vector indices:
                # 0: icao24, 1: callsign, 2: origin_country, 3: time_position
                # 4: last_contact, 5: longitude, 6: latitude, 7: baro_altitude
                # 8: on_ground, 9: velocity, 10: true_track, 11: vertical_rate
                # 12: sensors, 13: geo_altitude, 14: squawk, 15: spi, 16: position_source
                
                if state[6] is None or state[5] is None:  # lat, lon
                    continue
                
                # Convert altitude from meters to feet (use geo_altitude if available, else baro)
                altitude_m = state[13] if state[13] is not None else state[7]
                altitude_ft = (altitude_m * 3.28084) if altitude_m is not None else 0
                
                # Convert velocity from m/s to knots
                velocity_knots = (state[9] * 1.94384) if state[9] is not None else None
                
                # Calculate distance from airport
                distance = haversine_distance(lat, lon, state[6], state[5])
                
                aircraft_list.append({
                    "icao24": state[0],
                    "callsign": state[1].strip() if state[1] else None,
                    "latitude": state[6],
                    "longitude": state[5],
                    "altitude_ft": altitude_ft,
                    "velocity_knots": velocity_knots,
                    "heading": state[10],  # true_track
                    "vertical_rate": state[11] * 3.28084 / 60 if state[11] is not None else None,  # Convert to ft/min
                    "on_ground": state[8],
                    "distance_km": round(distance, 2)
                })
            
            return aircraft_list
            
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenSky API error: {e}")
            raise HTTPException(status_code=502, detail=f"OpenSky API error: {str(e)}")
        except Exception as e:
            logger.error(f"Error fetching aircraft data: {e}")
            raise HTTPException(status_code=500, detail=f"Error fetching aircraft data: {str(e)}")

def analyze_landing_aircraft(aircraft_list: List[dict], airport: dict, max_altitude_agl_ft: float = 1000) -> List[dict]:
    """Filter aircraft that are likely landing"""
    landing_aircraft = []
    airport_elevation = airport.get("elevation_ft", 0)
    
    for ac in aircraft_list:
        # Skip aircraft on ground
        if ac.get("on_ground", False):
            continue
        
        # Calculate altitude above ground level
        agl = ac["altitude_ft"] - airport_elevation
        
        # Criteria for landing aircraft:
        # 1. Below 1000ft AGL (as specified by user)
        # 2. Descending (negative vertical rate) OR very low and slow
        # 3. Has valid heading
        # 4. Reasonable distance from airport (within 15km for final approach)
        
        is_low = agl > 0 and agl < max_altitude_agl_ft
        is_descending = ac.get("vertical_rate") is not None and ac["vertical_rate"] < 0
        has_heading = ac.get("heading") is not None
        is_close = ac.get("distance_km", 100) < 15
        is_slow = ac.get("velocity_knots") is not None and ac["velocity_knots"] < 200
        
        # Landing if: low altitude AND (descending OR very low and slow) AND has heading
        if is_low and has_heading and is_close and (is_descending or (agl < 500 and is_slow)):
            landing_aircraft.append(ac)
    
    return landing_aircraft

def match_aircraft_to_runways(landing_aircraft: List[dict], runways: List[dict]) -> Dict[str, List[dict]]:
    """Match landing aircraft to specific runways based on heading"""
    runway_matches = {}
    
    for ac in landing_aircraft:
        if ac.get("heading") is None:
            continue
        
        best_runway = None
        best_direction = None
        best_diff = 180
        
        for runway in runways:
            heading_keys = [k for k in runway.keys() if k.startswith("heading_")]
            
            for key in heading_keys:
                rwy_heading = runway[key]
                diff = heading_difference(ac["heading"], rwy_heading)
                
                if diff < best_diff:
                    best_diff = diff
                    best_runway = runway
                    direction = get_runway_direction_from_heading(runway, ac["heading"])
                    if direction:
                        best_direction = direction
        
        # Only match if heading is within 20 degrees of runway
        if best_diff < 20 and best_direction:
            key = f"{best_runway['name']}_{best_direction}"
            if key not in runway_matches:
                runway_matches[key] = {
                    "runway": best_runway,
                    "direction": best_direction,
                    "aircraft": []
                }
            runway_matches[key]["aircraft"].append(ac)
    
    return runway_matches

# ============================================
# API ROUTES
# ============================================

@api_router.get("/")
async def root():
    return {"message": "Flight QFU Tracker API", "version": "1.0.0"}

@api_router.get("/airports")
async def get_airports() -> List[AirportInfo]:
    """Get list of all supported airports"""
    airports = []
    for icao, data in AIRPORT_DATABASE.items():
        airports.append(AirportInfo(
            icao=icao,
            name=data["name"],
            city=data["city"],
            country=data["country"],
            lat=data["lat"],
            lon=data["lon"],
            elevation_ft=data["elevation_ft"]
        ))
    return sorted(airports, key=lambda x: x.icao)

@api_router.get("/airports/{icao}")
async def get_airport(icao: str) -> dict:
    """Get detailed information about a specific airport"""
    icao = icao.upper()
    if icao not in AIRPORT_DATABASE:
        raise HTTPException(status_code=404, detail=f"Airport {icao} not found in database")
    
    airport = AIRPORT_DATABASE[icao]
    return {
        "icao": icao,
        **airport
    }

@api_router.get("/runway-status/{icao}")
async def get_runway_status(icao: str) -> RunwayAnalysisResponse:
    """Get current landing runway directions for an airport"""
    icao = icao.upper()
    
    if icao not in AIRPORT_DATABASE:
        raise HTTPException(status_code=404, detail=f"Airport {icao} not found. Use /api/airports to see available airports.")
    
    airport = AIRPORT_DATABASE[icao]
    
    # Fetch aircraft from OpenSky
    logger.info(f"Fetching aircraft near {icao}...")
    all_aircraft = await fetch_aircraft_from_opensky(airport["lat"], airport["lon"], radius_km=30)
    logger.info(f"Found {len(all_aircraft)} aircraft near {icao}")
    
    # Analyze landing aircraft
    landing_aircraft = analyze_landing_aircraft(all_aircraft, airport)
    logger.info(f"Found {len(landing_aircraft)} landing aircraft")
    
    # Match to runways
    runway_matches = match_aircraft_to_runways(landing_aircraft, airport["runways"])
    
    # Build response
    active_runways = []
    for key, match in runway_matches.items():
        rwy_heading = None
        for hkey in match["runway"].keys():
            if hkey.startswith("heading_"):
                dir_num = hkey.replace("heading_", "")
                # Match direction number
                dir_only = ''.join(filter(str.isdigit, match["direction"]))
                if dir_only == dir_num:
                    rwy_heading = match["runway"][hkey]
                    break
        
        active_runways.append(RunwayStatus(
            runway_name=match["runway"]["name"],
            direction=match["direction"],
            heading=rwy_heading or 0,
            aircraft_count=len(match["aircraft"]),
            aircraft=[Aircraft(**ac) for ac in match["aircraft"]]
        ))
    
    # Sort by aircraft count
    active_runways.sort(key=lambda x: x.aircraft_count, reverse=True)
    
    # Build message
    if active_runways:
        directions = [f"{r.direction}" for r in active_runways]
        message = f"Active landing runways: {', '.join(directions)}"
    else:
        if landing_aircraft:
            message = "Aircraft detected but no clear runway alignment"
        elif all_aircraft:
            message = "No landing aircraft detected at this time (aircraft in area but not on final approach)"
        else:
            message = "No aircraft detected near the airport"
    
    return RunwayAnalysisResponse(
        airport=AirportInfo(
            icao=icao,
            name=airport["name"],
            city=airport["city"],
            country=airport["country"],
            lat=airport["lat"],
            lon=airport["lon"],
            elevation_ft=airport["elevation_ft"]
        ),
        timestamp=datetime.utcnow(),
        active_runways=active_runways,
        total_landing_aircraft=len(landing_aircraft),
        all_aircraft_nearby=[Aircraft(**ac) for ac in sorted(all_aircraft, key=lambda x: x.get("distance_km", 100))[:50]],
        message=message
    )

@api_router.get("/search-airports/{query}")
async def search_airports(query: str) -> List[AirportInfo]:
    """Search airports by ICAO code, name, or city"""
    query = query.upper()
    results = []
    
    for icao, data in AIRPORT_DATABASE.items():
        if query in icao or \
           query in data["name"].upper() or \
           query in data["city"].upper() or \
           query in data["country"].upper():
            results.append(AirportInfo(
                icao=icao,
                name=data["name"],
                city=data["city"],
                country=data["country"],
                lat=data["lat"],
                lon=data["lon"],
                elevation_ft=data["elevation_ft"]
            ))
    
    return sorted(results, key=lambda x: x.icao)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
