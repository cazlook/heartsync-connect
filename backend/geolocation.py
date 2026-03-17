import math
from typing import Optional

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates using Haversine formula
    Returns distance in kilometers
    """
    # Radius of Earth in kilometers
    R = 6371.0
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Haversine formula
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return round(distance, 2)

def filter_by_distance(
    items: list,
    user_lat: float,
    user_lon: float,
    max_distance_km: Optional[float] = None
) -> list:
    """
    Filter items by distance and add distance field
    Items must have location.latitude and location.longitude
    """
    results = []
    
    for item in items:
        if not item.get('location'):
            continue
            
        lat = item['location'].get('latitude')
        lon = item['location'].get('longitude')
        
        if lat is None or lon is None:
            continue
        
        distance = calculate_distance(user_lat, user_lon, lat, lon)
        
        if max_distance_km is None or distance <= max_distance_km:
            item['distance_km'] = distance
            results.append(item)
    
    # Sort by distance
    results.sort(key=lambda x: x.get('distance_km', float('inf')))
    
    return results
