import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Polygon
import string

def get_label(n):
    """Generates alphabetical labels: A, B, ..., Z, AA, AB, etc."""
    result = ""
    n += 1
    while n > 0:
        n, remainder = divmod(n - 1, 26)
        result = string.ascii_uppercase[remainder] + result
    return result

def draw_pointy_t_container_with_debug():
    s = 1.0
    h = np.sqrt(3) / 2 
    angles = [0.0, 1.0471975511965976, 2.0943951023931953, 3.141592653589793, 
              4.1887902047863905, 5.235987755982989, 0.0]
    
    # FIXED: Added to width_ratios
    fig, (ax, ax_debug) = plt.subplots(1, 2, figsize=(16, 10), gridspec_kw={'width_ratios': [1, 1]})
    ax.set_aspect('equal')
    ax.axis('off')
    ax_debug.axis('off')
    
    debug_logs = []
    label_counter = 0

    def log_debug(msg):
        debug_logs.append(msg)
        print(msg)

    def draw_hexagon(cx, cy, hex_num):
        nonlocal label_counter
        log_debug(f"Hexagon {hex_num} start: ({cx}, {cy})")
        for i in range(6):
            v1 = [cx, cy]
            v2 = [cx + s * np.cos(angles[i]), cy + s * np.sin(angles[i])]
            v3 = [cx + s * np.cos(angles[i+1]), cy + s * np.sin(angles[i+1])]
            
            # FIXED: Indexing floats and to avoid TypeError
            tx = (v1[0] + v2[0] + v3[0]) / 3.0
            ty = (v1[1] + v2[1] + v3[1]) / 3.0
            
            tri = Polygon([v1, v2, v3], closed=True, facecolor='#FDEBD0', edgecolor='black', linewidth=0.5)
            ax.add_patch(tri)
            ax.text(tx, ty, get_label(label_counter), fontsize=8, ha='center', va='center')
            label_counter += 1
            
        hx = [cx + s * np.cos(a) for a in angles]
        hy = [cy + s * np.sin(a) for a in angles]
        ax.plot(hx, hy, color='black', linewidth=2)
        ax.text(cx, cy, str(hex_num), fontsize=20, weight='bold', ha='center', va='center', alpha=0.2)

    def draw_red_infill(v1, v2, v3):
        nonlocal label_counter
        filler = Polygon([v1, v2, v3], closed=True, facecolor='red', edgecolor='black', linewidth=1.2)
        ax.add_patch(filler)
        
        # FIXED: Indexing floats and
        tx = (v1[0] + v2[0] + v3[0]) / 3.0
        ty = (v1[1] + v2[1] + v3[1]) / 3.0
        
        label = get_label(label_counter)
        ax.text(tx, ty, label, fontsize=9, color='white', weight='bold', ha='center', va='center')
        log_debug(f"Red Infill: Label {label}")
        label_counter += 1

    h_dist, v_dist = 2.0 * s, 1.73205 * s
    draw_hexagon(-h_dist, 0, 1)
    draw_hexagon(0, 0, 2)
    draw_hexagon(h_dist, 0, 3)
    draw_hexagon(0, v_dist, 4)
    draw_hexagon(0, 2 * v_dist, 5)
    draw_hexagon(0, 3 * v_dist, 6)

    draw_red_infill([-1.5, h], [-0.5, h], [-1.0, 0])      
    draw_red_infill([-1.5, -h], [-0.5, -h], [-1.0, 0])    
    draw_red_infill([0.5, h], [1.5, h], [1.0, 0])         
    draw_red_infill([0.5, -h], [1.5, -h], [1.0, 0])       

    debug_text = "\n".join(debug_logs)
    ax_debug.text(0, 1, f"DEBUG OUTPUT LOGS:\n\n{debug_text}", 
                  fontsize=11, family='monospace', verticalalignment='top')
    
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    plt.close('all')
    draw_pointy_t_container_with_debug()